import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { markerCatalog, MARKER_TYPES } from "./markers";
import type { InterviewTurn, MarkerType, PostureSignal, ScoredDelta } from "./types";

/**
 * The Interview agent client (ADR-0009): one Claude call per Turn.
 *
 * Given the transcript so far, a single tool-use call both *interprets and
 * scores* the latest answer against the Marker Catalog and *chooses the next
 * question*. Structured output is forced via a tool schema so the result is
 * machine-checkable rather than free-form prose; the pure Scoring engine
 * (`scoring.ts`) then applies the cited deltas under its cite-only / additive
 * invariants.
 *
 * The static context — the rubric, tribe essences, and the whole Marker Catalog
 * — is identical on every Turn, so it is assembled once and sent as a cached
 * system block (`cache_control: ephemeral`). Across a Session's Turns the model
 * re-reads it from cache instead of re-ingesting it, keeping per-Turn cost and
 * latency low. Only the volatile transcript changes Turn to Turn.
 *
 * `server-only` (ADR-0009/0010): the catalog and the model call never reach the
 * client.
 */

/** The model the Interview agent calls. Override per-deploy via `INTERVIEW_MODEL`. */
const MODEL = process.env.INTERVIEW_MODEL ?? "claude-sonnet-5";

const TOOL_NAME = "score_answer";

const POSTURE_SIGNALS: readonly PostureSignal[] = [
  "active-shadow",
  "neutral",
  "integrated",
];

/**
 * The static scoring rubric. Kept terse and stable — it is part of the cached
 * prefix, so wording churn would cost cache hits.
 */
const RUBRIC = `You are the scoring engine for a blind personality Interview that infers which of twelve biblical-tribe archetypes a participant is wired like, from how they talk about themselves.

For the participant's most recent answer:
- Identify only the Markers from the catalog below that genuinely fire in THIS answer. Cite each by its exact "id". Do not invent Markers or rationale; if nothing fires, return an empty "deltas" list.
- For each fired Marker, set "delta" to how strongly the answer expresses it, from 0 (barely) to 1 (unmistakably).
- "tribeSlug" and "type" must match the cited Marker exactly (they are echoed for verification; a mismatch is discarded).
- shadow and fall-line Markers are evidence the participant RESONATES with a tribe's wiring — score them like any other signal; never treat them as negatives.
- Set "postureSignal" when the answer reveals where they sit on the tribe's fall→oil arc: "active-shadow" (living the unredeemed pattern now), "integrated" (matured past it), or "neutral" (unclear).

Then write "nextQuestion": one neutral, open-ended question that helps distinguish the tribes still in contention. Never name a tribe, never telegraph a "right" answer, and don't repeat a question already asked.`;

/** Every tribe's essence, so the model knows what each slug means. */
const TRIBE_CONTEXT = tribes
  .map((t) => `- ${t.slug} (${t.name}, ${t.callSign}): ${t.essence}`)
  .join("\n");

/** The full catalog rendered for the prompt — the rigor-bearing static context. */
const CATALOG_CONTEXT = markerCatalog
  .map((m) => {
    const parts = [`- id: ${m.id} | tribe: ${m.tribeSlug} | type: ${m.type} | ${m.signal}`];
    if (m.exemplar) parts.push(`    example: ${m.exemplar}`);
    if (m.counterExemplar) parts.push(`    not this: ${m.counterExemplar}`);
    return parts.join("\n");
  })
  .join("\n");

/** The assembled, frozen static system prompt sent (cached) on every Turn. */
const STATIC_SYSTEM = `${RUBRIC}

TRIBES:
${TRIBE_CONTEXT}

MARKER CATALOG:
${CATALOG_CONTEXT}`;

const SCORING_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Record the Marker-cited scoring of the participant's latest answer and choose the next question.",
  input_schema: {
    type: "object",
    properties: {
      deltas: {
        type: "array",
        description:
          "One entry per catalogued Marker that genuinely fired in the latest answer. Empty if none fired.",
        items: {
          type: "object",
          properties: {
            markerId: { type: "string", description: "Exact id of a Marker in the catalog." },
            tribeSlug: { type: "string", description: "The cited Marker's tribe (echoed)." },
            type: { type: "string", enum: [...MARKER_TYPES] },
            delta: {
              type: "number",
              description: "Signal strength in the answer, 0 to 1.",
            },
            postureSignal: { type: "string", enum: [...POSTURE_SIGNALS] },
          },
          required: ["markerId", "tribeSlug", "type", "delta"],
        },
      },
      nextQuestion: {
        type: "string",
        description: "A neutral, open-ended next question. Never names a tribe.",
      },
    },
    required: ["deltas", "nextQuestion"],
  },
};

export interface ScoredTurn {
  /** Cited Marker deltas for the latest answer (already shape-validated). */
  deltas: ScoredDelta[];
  /** The agent-produced next question to show. */
  nextQuestion: string;
}

/** Render the transcript as the single volatile user message. */
function renderTranscript(turns: readonly InterviewTurn[]): string {
  const history = turns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
    .join("\n\n");
  return `Interview so far (score the FINAL answer, then choose the next question):\n\n${history}`;
}

const MARKER_TYPE_SET = new Set<string>(MARKER_TYPES);
const POSTURE_SET = new Set<string>(POSTURE_SIGNALS);

/** Coerce one raw tool-input entry into a `ScoredDelta`, or null if malformed. */
function toScoredDelta(raw: unknown): ScoredDelta | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.markerId !== "string" || !r.markerId) return null;
  if (typeof r.tribeSlug !== "string") return null;
  if (typeof r.type !== "string" || !MARKER_TYPE_SET.has(r.type)) return null;
  if (typeof r.delta !== "number" || Number.isNaN(r.delta)) return null;
  const delta: ScoredDelta = {
    markerId: r.markerId,
    tribeSlug: r.tribeSlug,
    type: r.type as MarkerType,
    delta: r.delta,
  };
  if (typeof r.postureSignal === "string" && POSTURE_SET.has(r.postureSignal)) {
    delta.postureSignal = r.postureSignal as PostureSignal;
  }
  return delta;
}

/** Parse the forced tool_use payload into a validated `ScoredTurn`. */
function parseToolInput(input: unknown): ScoredTurn {
  const obj = (input ?? {}) as Record<string, unknown>;
  const rawDeltas = Array.isArray(obj.deltas) ? obj.deltas : [];
  const deltas = rawDeltas
    .map(toScoredDelta)
    .filter((d): d is ScoredDelta => d !== null);
  const nextQuestion =
    typeof obj.nextQuestion === "string" && obj.nextQuestion.trim()
      ? obj.nextQuestion.trim()
      : "";
  return { deltas, nextQuestion };
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. See .env.example.");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Score the latest answer in `turns` against the Marker Catalog and choose the
 * next question, in one cached tool-use call. `turns` must be non-empty (the
 * last Turn is the one being scored).
 */
export async function scoreTurn(turns: readonly InterviewTurn[]): Promise<ScoredTurn> {
  if (turns.length === 0) {
    throw new Error("scoreTurn requires at least one answered Turn to score.");
  }

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    // The static rubric + catalog is a cached prefix; only the transcript below
    // is volatile, so the model re-reads the catalog from cache each Turn.
    system: [
      {
        type: "text",
        text: STATIC_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SCORING_TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: renderTranscript(turns) }],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Interview agent did not return a tool_use scoring payload.");
  }
  return parseToolInput(toolUse.input);
}
