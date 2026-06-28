import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { markerCatalog } from "./markers";
import type { InterviewTurn, ScoreDelta } from "./types";

/**
 * The Interview agent client (PRD #13, slice #16) — the glue between the pure
 * scoring engine and Claude via the Anthropic SDK (ADR-0009).
 *
 * This module is **server-only**: it holds the API key, the Marker Catalog, and
 * the scoring rubric, none of which may reach the client (ADR-0009/0010 trust
 * boundary). Each call uses **tool-use for structured output** (ADR-0009): the
 * model must return a validated `interview_turn` payload — the Markers it cites
 * for the answer (`deltas`) and the next question to ask. Question generation and
 * answer scoring share one tool and one system prompt so the `tools` + `system`
 * prefix is byte-identical across calls and the large static context is served
 * from the **prompt cache** on every Turn after the first.
 *
 * The agent's freedom is asymmetric by design (ADR-0003): free to ask anything,
 * but it may only *score* by citing a catalogued Marker. The cited `tribeSlug` /
 * `type` are advisory — the scoring engine resolves them authoritatively from
 * the catalog and drops any unknown id — so this layer does not need to trust
 * the payload.
 */

const MODEL = process.env.INTERVIEW_MODEL ?? "claude-opus-4-8";

/** A safe opener used when the model can't be reached (e.g. no API key in dev). */
const FALLBACK_OPENING_QUESTION =
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?";

const TOOL_NAME = "interview_turn";

interface InterviewTurnPayload {
  deltas: ScoreDelta[];
  nextQuestion: string | null;
}

/**
 * The static context sent every Turn: the tribe profiles, the Marker Catalog,
 * and the scoring rubric. Built once at module load and never interpolated with
 * per-request data, so its bytes are stable and it caches (ADR-0009).
 */
const STATIC_CONTEXT = buildStaticContext();

const INTERVIEW_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Record the result of one interview Turn: the Markers cited for the " +
    "participant's answer, and the next question to ask (or null to stop).",
  input_schema: {
    type: "object",
    properties: {
      deltas: {
        type: "array",
        description:
          "Markers cited for THIS answer. Empty when there is no answer to " +
          "score yet (e.g. the opening question).",
        items: {
          type: "object",
          properties: {
            markerId: {
              type: "string",
              description: "The Marker id from the catalog (e.g. 'judah-oil-responsibility').",
            },
            tribeSlug: { type: "string", description: "The Marker's tribe slug." },
            type: {
              type: "string",
              enum: ["strength", "oil", "shadow", "fallLine"],
            },
            delta: {
              type: "number",
              description:
                "Signal strength for this Marker, 0 to its weight. Use the full " +
                "weight only for an unmistakable, first-person match.",
            },
            postureSignal: {
              type: "string",
              enum: ["active-shadow", "neutral", "integrated"],
              description:
                "Where on the fall→oil arc the answer points: active-shadow " +
                "(living the dysfunction), neutral, or integrated (matured past it).",
            },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
          additionalProperties: false,
        },
      },
      nextQuestion: {
        type: ["string", "null"],
        description:
          "The next question to ask the participant, or null to end the interview.",
      },
    },
    required: ["deltas", "nextQuestion"],
    additionalProperties: false,
  },
};

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

/**
 * Run one agent Turn. Sends the (shared, cached) static context plus the current
 * exchange and returns the validated structured payload. Throws if the model is
 * unreachable or returns no tool call — callers decide how to recover.
 */
async function callAgent(userText: string): Promise<InterviewTurnPayload> {
  const anthropic = getClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      { type: "text", text: STATIC_CONTEXT, cache_control: { type: "ephemeral" } },
    ],
    tools: [INTERVIEW_TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: userText }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Interview agent returned no tool call.");
  }

  return parsePayload(toolUse.input);
}

/**
 * Produce the opening question. There is no answer to score yet, so the payload
 * carries the question and empty deltas. Falls back to a fixed opener if the
 * model is unreachable, so the flow still works in local dev without a key.
 */
export async function generateOpeningQuestion(): Promise<string> {
  try {
    const { nextQuestion } = await callAgent(
      "This is the start of the interview. There is no answer to score yet. " +
        "Return an empty `deltas` array and, in `nextQuestion`, a single warm, " +
        "broad opening question that invites the participant to talk about " +
        "themselves without telegraphing any tribe.",
    );
    return nextQuestion?.trim() || FALLBACK_OPENING_QUESTION;
  } catch {
    return FALLBACK_OPENING_QUESTION;
  }
}

/**
 * Score a participant's answer against the Marker Catalog, returning the cited
 * deltas. The single-Turn slice stops after one scored answer, so the next
 * question is not used here.
 */
export async function scoreAnswer(
  question: string,
  answer: string,
  history: InterviewTurn[] = [],
): Promise<ScoreDelta[]> {
  const priorContext =
    history.length > 0
      ? "Earlier in the interview:\n" +
        history.map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`).join("\n") +
        "\n\n"
      : "";

  const { deltas } = await callAgent(
    priorContext +
      `The participant was asked:\n${question}\n\n` +
      `They answered:\n${answer}\n\n` +
      "Score this answer by citing Markers from the catalog in `deltas`. Cite a " +
      "fall-line or shadow Marker on resonance with the theme — including when " +
      "the participant describes having matured past the tendency — never to " +
      "penalize. Set `nextQuestion` to null.",
  );
  return deltas;
}

/** Validate the model's tool input into a payload, dropping malformed deltas. */
function parsePayload(input: unknown): InterviewTurnPayload {
  const obj = (input ?? {}) as Record<string, unknown>;
  const rawDeltas = Array.isArray(obj.deltas) ? obj.deltas : [];
  const deltas: ScoreDelta[] = [];

  for (const raw of rawDeltas) {
    if (typeof raw !== "object" || raw === null) continue;
    const d = raw as Record<string, unknown>;
    if (typeof d.markerId !== "string") continue;
    if (typeof d.delta !== "number") continue;
    deltas.push({
      markerId: d.markerId,
      tribeSlug: typeof d.tribeSlug === "string" ? d.tribeSlug : "",
      type:
        d.type === "oil" || d.type === "shadow" || d.type === "fallLine"
          ? d.type
          : "strength",
      delta: d.delta,
      postureSignal:
        d.postureSignal === "active-shadow" || d.postureSignal === "integrated"
          ? d.postureSignal
          : "neutral",
    });
  }

  const nextQuestion = typeof obj.nextQuestion === "string" ? obj.nextQuestion : null;
  return { deltas, nextQuestion };
}

/** Assemble the cached static context from the tribe profiles and Marker Catalog. */
function buildStaticContext(): string {
  const profiles = tribes
    .map(
      (t) =>
        `### ${t.name} — ${t.callSign} (slug: ${t.slug})\n` +
        `Essence: ${t.essence}\n` +
        `Strengths: ${t.strengths}\n` +
        `Oil (what makes them thrive): ${t.oil}\n` +
        `Shadow: ${t.shadowConstraints}\n` +
        `Fall line: ${t.fallLine}`,
    )
    .join("\n\n");

  const markers = markerCatalog
    .map(
      (m) =>
        `- ${m.id} | tribe=${m.tribeSlug} | type=${m.type} | weight=${m.weight}\n` +
        `  signal: ${m.signal}` +
        (m.exemplar ? `\n  exemplar: ${m.exemplar}` : ""),
    )
    .join("\n");

  return [
    "You are the scoring engine for the Tribe Index Interview — a blind, adaptive",
    "instrument that infers which of the 12 biblical-tribe archetypes a person is",
    "wired for from how they talk about themselves.",
    "",
    "## The 12 tribes",
    profiles,
    "",
    "## Marker Catalog",
    "Every strength you assign MUST cite a Marker `id` from this catalog. Do not",
    "invent Markers or score without one. A Marker's `weight` is the maximum",
    "contribution a single citation can make; use the full weight only for an",
    "unmistakable, first-person match and less when the signal is faint.",
    "",
    markers,
    "",
    "## Scoring rules",
    "- Score only from the cited Markers; never free-form rationale.",
    "- Shadow and fall-line Markers are ADDITIVE evidence of the tribe, not",
    "  penalties — a person who describes maturing past a fall-line is showing",
    "  resonance with that tribe's theme. Cite the fall-line (or the tribe's oil",
    "  Marker) and mark postureSignal `integrated`; never lower a score for it.",
    "- Distinguish integrated (matured, real, felt internally) from not-resonant",
    "  (genuinely not this tribe) by the first-person emotional texture of the",
    "  answer, not third-person conceptual description.",
    "- All 12 tribes are eligible, including the disqualified ones.",
    "- Keep questions neutral; never telegraph the 'right' answer.",
  ].join("\n");
}
