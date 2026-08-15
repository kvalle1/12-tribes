import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { tribes } from "@/lib/tribes";
import { markerCatalog } from "./markers";
import { POSTURE_SIGNALS } from "./types";
import type { MarkerDelta, PostureSignal } from "./types";

/**
 * The Interview's scoring agent (ADR-0009): one Claude call per Turn, via the
 * Anthropic SDK, that both **interprets and scores** a free-text answer against
 * the Marker Catalog and **proposes the next question**. It is server-only — the
 * catalog, the rubric, and the API key never reach the client.
 *
 * Structured output is forced with tool-use: `tool_choice` pins the model to the
 * `record_scoring` tool, so the response is always a single tool call whose input
 * we coerce into `MarkerDelta`s. (Forcing a tool requires thinking disabled;
 * `effort` stays at its default `high`, where disabling thinking is allowed.)
 *
 * The static context — Marker Catalog, tribe roster, rubric — is identical every
 * Turn, so it is sent once as a cached system block (ADR-0009 prompt caching).
 * Only the volatile per-Turn content (the question, the answer, the running
 * attribution) follows the cache breakpoint, so later Turns read the cache.
 */

/** The model that scores the Interview. Overridable, defaulting to the current Opus. */
const INTERVIEW_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

const SCORING_TOOL_NAME = "record_scoring";

/**
 * The static scoring context, built once at module load from the (fixed) Marker
 * Catalog and tribe roster. Byte-stable across Turns so the cached prefix holds.
 */
const STATIC_CONTEXT = buildStaticContext();

function buildStaticContext(): string {
  const roster = tribes
    .map((t) => `- ${t.slug} — ${t.name} (${t.essence})`)
    .join("\n");

  const catalog = markerCatalog
    .map(
      (m) =>
        `- ${m.id} | tribe=${m.tribeSlug} | type=${m.type} | weight=${m.weight}\n    signal: ${m.signal}`,
    )
    .join("\n");

  return [
    "You are the scoring engine for a blind personality Interview that maps a person to one of twelve biblical-tribe archetypes from how they describe themselves in their own words.",
    "",
    "Your job each turn: read the participant's free-text answer, decide which catalogued Markers it genuinely evidences, and record a bounded strength delta for each — then propose the next question.",
    "",
    "Hard rules:",
    `- You may ONLY score by citing a Marker id from the catalog below. Never invent a Marker, and never score a tribe without citing one of its Markers. A citation whose tribe or type does not match the catalogued Marker is discarded.`,
    `- 'delta' is a strength contribution in the range 0 to the Marker's 'weight'. Score only what the answer actually evidences; most answers fire only a few Markers, and many fire none.`,
    `- Shadow and fall-line Markers are DIAGNOSTIC of a tribe's wiring, not disqualifying. They add to strength like any other Marker. A fall-line fires on resonance with the theme (the felt internal pull), whether the person is captive to it or has matured past it — never on absence of dysfunction.`,
    `- 'postureSignal' records where the person sits on that tribe's fall→oil arc for this answer: ${POSTURE_SIGNALS.join(
      ", ",
    )} (captive to the fall-line, aware of the pull, or matured past it). It does not change the strength delta.`,
    "- Scoring is status-blind: all twelve tribes are eligible, including disqualified ones.",
    "",
    "Next question: a single neutral, open, situation-or-behavior question that best separates the tribes still in contention. Never name a tribe or lead the participant toward an answer.",
    "",
    "Tribe roster (slug — name):",
    roster,
    "",
    "Marker Catalog (cite these ids):",
    catalog,
  ].join("\n");
}

const SCORING_TOOL: Anthropic.Tool = {
  name: SCORING_TOOL_NAME,
  description:
    "Record the per-Marker strength deltas evidenced by the participant's answer, and the next question to ask.",
  input_schema: {
    type: "object",
    properties: {
      deltas: {
        type: "array",
        description:
          "One entry per catalogued Marker the answer genuinely evidences. May be empty.",
        items: {
          type: "object",
          properties: {
            markerId: {
              type: "string",
              description: "A Marker id copied verbatim from the catalog.",
            },
            tribeSlug: {
              type: "string",
              description: "The Marker's tribe slug (must match the catalog).",
            },
            type: {
              type: "string",
              enum: ["strength", "oil", "shadow", "fallLine"],
            },
            delta: {
              type: "number",
              description: "Strength contribution, 0 to the Marker's weight.",
            },
            postureSignal: {
              type: "string",
              enum: [...POSTURE_SIGNALS],
            },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
          additionalProperties: false,
        },
      },
      nextQuestion: {
        type: "string",
        description:
          "The next neutral, open question to ask. Never names or leads toward a tribe.",
      },
    },
    required: ["deltas", "nextQuestion"],
    additionalProperties: false,
  },
};

let client: Anthropic | null = null;

/**
 * Construct the SDK client lazily, so importing this module (e.g. during a build)
 * never fails for want of a key — only an actual scoring call does. The SDK reads
 * `ANTHROPIC_API_KEY` (and `ANTHROPIC_BASE_URL`) from the environment.
 */
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. See .env.example.");
  }
  return (client ??= new Anthropic());
}

export interface ScoreAnswerInput {
  /** The question the participant was answering. */
  question: string;
  /** Their free-text answer. */
  answer: string;
  /** The running per-tribe attribution (percentages), so the agent can ask a discriminating next question. */
  attribution: Record<string, number>;
}

export interface ScoreAnswerResult {
  deltas: MarkerDelta[];
  nextQuestion: string;
}

/** Render the volatile per-Turn content that follows the cached prefix. */
function buildTurnPrompt(input: ScoreAnswerInput): string {
  const standings = Object.entries(input.attribution)
    .filter(([, pct]) => pct > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([slug, pct]) => `${slug}=${pct.toFixed(0)}%`)
    .join(", ");

  return [
    `Running attribution so far: ${standings || "none yet"}.`,
    "",
    `Question asked: ${input.question}`,
    `Participant's answer: ${input.answer}`,
    "",
    "Score this answer against the Marker Catalog and propose the next question.",
  ].join("\n");
}

/**
 * Score one free-text answer against the Marker Catalog and propose the next
 * question. Runs one tool-forced Claude call; the returned deltas are
 * shape-validated here and then re-validated against the catalog by the pure
 * Scoring engine before they touch the profile.
 */
export async function scoreAnswer(
  input: ScoreAnswerInput,
): Promise<ScoreAnswerResult> {
  const response = await getClient().messages.create({
    model: INTERVIEW_MODEL,
    max_tokens: 2048,
    thinking: { type: "disabled" },
    system: [
      {
        type: "text",
        text: STATIC_CONTEXT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SCORING_TOOL],
    tool_choice: { type: "tool", name: SCORING_TOOL_NAME },
    messages: [{ role: "user", content: buildTurnPrompt(input) }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === SCORING_TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error("Scoring agent returned no tool call.");
  }

  return coerceScoringOutput(toolUse.input);
}

/**
 * Defensively coerce the tool call's `input` into the scoring result. Malformed
 * entries are dropped rather than trusted; the pure Scoring engine still has the
 * final say on whether each surviving delta cites a valid Marker. Exported so the
 * validation is unit-testable without hitting the network.
 */
export function coerceScoringOutput(raw: unknown): ScoreAnswerResult {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const rawDeltas = Array.isArray(obj.deltas) ? obj.deltas : [];
  const deltas: MarkerDelta[] = [];
  for (const entry of rawDeltas) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const markerId = typeof e.markerId === "string" ? e.markerId : null;
    const tribeSlug = typeof e.tribeSlug === "string" ? e.tribeSlug : null;
    const type = e.type;
    const delta = typeof e.delta === "number" ? e.delta : Number(e.delta);
    const postureSignal = e.postureSignal;

    if (!markerId || !tribeSlug) continue;
    if (
      type !== "strength" &&
      type !== "oil" &&
      type !== "shadow" &&
      type !== "fallLine"
    ) {
      continue;
    }
    if (!Number.isFinite(delta)) continue;
    if (!POSTURE_SIGNALS.includes(postureSignal as PostureSignal)) continue;

    deltas.push({
      markerId,
      tribeSlug,
      type,
      delta,
      postureSignal: postureSignal as PostureSignal,
    });
  }

  const nextQuestion =
    typeof obj.nextQuestion === "string" && obj.nextQuestion.trim()
      ? obj.nextQuestion.trim()
      : "";

  return { deltas, nextQuestion };
}
