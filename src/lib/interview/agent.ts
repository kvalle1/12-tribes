import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { markerCatalog, MARKER_TYPES } from "./markers";
import type { MarkerDelta, PostureSignal } from "./score";

/**
 * The Interview agent client (issue #16, ADR-0009) — the single seam between the
 * server-authoritative loop and Claude. Given a participant's free-text answer,
 * one tool-use call both **interprets/scores** the answer (returning per-tribe
 * Marker deltas) and **chooses the next question**.
 *
 * This module is `server-only`: the Marker Catalog and API key are scoring
 * concerns that must never reach the client (ADR-0009 trust boundary).
 *
 * Scoring is constrained, not free-form (ADR-0003): the tool schema forces the
 * model to cite a Marker `id` for every delta, and the pure scoring engine
 * (`score.ts`) drops any delta that doesn't resolve against the catalog. The
 * model's freedom is asymmetric by design — free to choose the next question,
 * constrained in what it may score.
 */

const MODEL = "claude-opus-4-8";

/** The structured payload the agent returns each Turn. */
export interface AgentTurn {
  /** Cited-Marker deltas to fold into the Strength Profile. */
  deltas: MarkerDelta[];
  /** The next question to ask the participant. */
  nextQuestion: string;
  /** One-line note on what the answer revealed (not shown to the participant). */
  summary: string;
}

/**
 * The static context sent with every Turn — the Marker Catalog, a compact tribe
 * reference, and the scoring rubric. It repeats verbatim on every request, so it
 * carries a `cache_control` breakpoint (ADR-0009) and lives in a module constant
 * to guarantee byte-stability across Turns and sessions (a stable prefix is what
 * makes the cache hit).
 */
const STATIC_CONTEXT = buildStaticContext();

function buildStaticContext(): string {
  const tribeLines = tribes
    .map((t) => `- ${t.slug} — ${t.name} (${t.callSign}): ${t.essence}`)
    .join("\n");

  const markerLines = markerCatalog
    .map((m) => {
      const parts = [
        `- id: ${m.id}`,
        `tribe: ${m.tribeSlug}`,
        `type: ${m.type}`,
        `weight: ${m.weight}`,
        `signal: ${m.signal}`,
      ];
      if (m.exemplar) parts.push(`exemplar: ${m.exemplar}`);
      if (m.counterExemplar) parts.push(`counter: ${m.counterExemplar}`);
      return parts.join(" | ");
    })
    .join("\n");

  return [
    "You are the scoring engine and interviewer for the Tribe Index Interview — a blind instrument that infers a person's tribe wiring from how they talk about themselves.",
    "",
    "THE TWELVE TRIBES (by slug):",
    tribeLines,
    "",
    "THE MARKER CATALOG. Each Marker is a concrete, observable signal. `type` is which part of the tribe's arc it draws from (strength, oil, shadow, fallLine). `weight` is how much it counts.",
    markerLines,
    "",
    "HOW TO SCORE:",
    "- You may ONLY score by citing a Marker `id` from the catalog above. Never invent a Marker or score a tribe without a citation.",
    "- For each Marker the answer genuinely evidences, emit one delta: { markerId, tribeSlug (must match the Marker), type (must match the Marker), delta, postureSignal }.",
    "- `delta` is the evidence STRENGTH in [0, 1] — how strongly this answer shows the Marker — NOT a final score. A faint hint is ~0.2; a vivid, first-person account is ~0.9.",
    "- A shadow or fall-line Marker fires on RESONANCE with the theme, not on current dysfunction. Someone who has matured past a fall-line still resonates with it — score it, and set postureSignal to \"integrated\". Active dysfunction is \"active-shadow\". Otherwise \"neutral\".",
    "- Do not force deltas. If an answer evidences nothing, return an empty deltas array.",
    "",
    "CHOOSING THE NEXT QUESTION:",
    "- Ask one open-ended, neutrally-phrased question that invites a concrete, first-person story. Never reveal which tribe a question probes, and never name tribes or Markers to the participant.",
  ].join("\n");
}

/**
 * The forced tool the model must call. `strict: true` guarantees the returned
 * `input` validates against this schema (so the caller never parses free-form
 * JSON), and `additionalProperties: false` + full `required` are its
 * preconditions. Numeric bounds on `delta` are intentionally omitted (strict
 * mode doesn't support them) — the scoring engine clamps to [0, 1] instead.
 */
const SCORING_TOOL: Anthropic.Tool = {
  name: "record_scoring",
  description:
    "Record the per-tribe Marker deltas evidenced by the participant's answer and choose the next question.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      deltas: {
        type: "array",
        description: "One entry per Marker the answer evidences. May be empty.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            markerId: {
              type: "string",
              description: "A Marker id from the catalog. Must exist.",
            },
            tribeSlug: {
              type: "string",
              description: "The Marker's tribe slug (must match the cited Marker).",
            },
            type: {
              type: "string",
              enum: [...MARKER_TYPES],
              description: "The Marker's type (must match the cited Marker).",
            },
            delta: {
              type: "number",
              description: "Evidence strength in [0, 1].",
            },
            postureSignal: {
              type: "string",
              enum: ["active-shadow", "integrated", "neutral"],
              description:
                "Where the answer sits on the tribe's fall→oil arc for this Marker.",
            },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
        },
      },
      nextQuestion: {
        type: "string",
        description: "The next open-ended, tribe-neutral question to ask.",
      },
      summary: {
        type: "string",
        description: "One line on what the answer revealed (internal, not shown).",
      },
    },
    required: ["deltas", "nextQuestion", "summary"],
  },
};

type ScoringToolInput = {
  deltas: Array<{
    markerId: string;
    tribeSlug: string;
    type: string;
    delta: number;
    postureSignal: PostureSignal;
  }>;
  nextQuestion: string;
  summary: string;
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. See .env.example.");
  }
  client ??= new Anthropic();
  return client;
}

/**
 * Score one answer and choose the next question. `priorQuestions` (oldest first)
 * are handed to the model so it doesn't repeat itself. The heavy static context
 * is prompt-cached; only the small per-Turn content varies between requests.
 */
export async function scoreInterviewAnswer(params: {
  question: string;
  answer: string;
  priorQuestions: string[];
}): Promise<AgentTurn> {
  const { question, answer, priorQuestions } = params;

  const askedBefore =
    priorQuestions.length > 0
      ? `Questions already asked (do not repeat):\n${priorQuestions
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}\n\n`
      : "";

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: STATIC_CONTEXT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SCORING_TOOL],
    tool_choice: { type: "tool", name: SCORING_TOOL.name },
    messages: [
      {
        role: "user",
        content: `${askedBefore}The participant was asked:\n"${question}"\n\nThey answered:\n"${answer}"\n\nScore this answer against the Marker Catalog and choose the next question.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === SCORING_TOOL.name,
  );
  if (!toolUse) {
    throw new Error("Interview scoring call returned no tool use.");
  }

  const input = toolUse.input as ScoringToolInput;
  return {
    deltas: input.deltas.map((d) => ({
      markerId: d.markerId,
      tribeSlug: d.tribeSlug,
      type: d.type as MarkerDelta["type"],
      delta: d.delta,
      postureSignal: d.postureSignal,
    })),
    nextQuestion: input.nextQuestion,
    summary: input.summary,
  };
}
