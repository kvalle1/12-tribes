import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { MARKER_TYPES, markerCatalog } from "./markers";
import type { InterviewTurn, MarkerType, ScoredDelta } from "./types";

/**
 * The Interview agent client (ADR-0009): one Claude call per Turn, via the
 * Anthropic SDK, using **tool-use for structured output**. A single call both
 * interprets/scores the participant's answer against the Marker Catalog and
 * chooses the next question. Server-only — the catalog, rubric, and API key
 * never reach the client (ADR-0009 trust boundary).
 *
 * The static context (rubric, tribe essences, Marker Catalog) is identical every
 * Turn, so it's frozen at module load and the largest block carries a
 * `cache_control` breakpoint — prompt caching keeps per-Turn cost/latency low.
 * Only the volatile transcript goes in the (uncached) user message, after the
 * cached prefix.
 */

/** Claude model for the Interview. Overridable, defaults to the current Opus. */
const MODEL = process.env.INTERVIEW_MODEL ?? "claude-opus-4-8";

const RUBRIC = `You are the scoring engine and interviewer for the Tribe Index Interview, a blind instrument that infers which of 12 biblical-tribe archetypes a person is wired toward from how they talk about themselves.

Your job each turn:
1. Read the participant's latest free-text answer.
2. Score it ONLY by citing Markers from the Marker Catalog below. Each cited delta must reference a real Marker id and its own tribe/type; do not invent rationale or score a tribe without a Marker. If the answer evidences nothing, return an empty delta list — never force a fit.
3. For each cited Marker, set "delta" to how strongly the answer evidences that signal, from 0 (not present) to 1 (unmistakable). Shadow and fall-line Markers are still evidence OF that tribe's wiring — cite them when the theme resonates.
4. Set "postureSignal" from -1 (living the tribe's active shadow / fall line) to 1 (integrated / matured past it), or 0 if unclear.
5. Choose the next question: neutral, open-ended, and never naming a tribe or telegraphing a "right" answer. Ask what would best reveal the person's wiring given what they've said.

Cite conservatively and specifically. A single answer usually evidences one to four Markers.`;

const TRIBES_CONTEXT =
  "TRIBES (name [slug]: essence)\n" +
  tribes.map((t) => `${t.name} [${t.slug}]: ${t.essence}`).join("\n");

const CATALOG_CONTEXT =
  "MARKER CATALOG (id [tribe/type]: signal)\n" +
  markerCatalog
    .map(
      (m) =>
        `- ${m.id} [${m.tribeSlug}/${m.type}]: ${m.signal}` +
        (m.exemplar ? ` (e.g. ${m.exemplar})` : ""),
    )
    .join("\n");

/**
 * Frozen static system prompt. Order (tools → system → messages) plus the
 * `cache_control` breakpoint on the final, largest block caches the whole
 * static prefix across Turns; anything volatile must come after it.
 */
const SYSTEM: Anthropic.TextBlockParam[] = [
  { type: "text", text: RUBRIC },
  { type: "text", text: TRIBES_CONTEXT },
  {
    type: "text",
    text: CATALOG_CONTEXT,
    cache_control: { type: "ephemeral" },
  },
];

const SCORING_TOOL: Anthropic.Tool = {
  name: "score_and_continue",
  description:
    "Record the Marker deltas evidenced by the participant's latest answer and choose the next interview question.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      deltas: {
        type: "array",
        description:
          "Cited Marker deltas evidenced by the answer. Empty if nothing fired. Only cite Marker ids from the catalog.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            markerId: {
              type: "string",
              description: "A catalogued Marker id, e.g. 'judah-strength-front'.",
            },
            tribeSlug: {
              type: "string",
              description: "The tribe slug the cited Marker belongs to.",
            },
            type: { type: "string", enum: [...MARKER_TYPES] },
            delta: {
              type: "number",
              description: "Evidence strength from 0 (absent) to 1 (unmistakable).",
            },
            postureSignal: {
              type: "number",
              description:
                "Arc position from -1 (active shadow / fall line) to 1 (integrated); 0 if unclear.",
            },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
        },
      },
      nextQuestion: {
        type: "string",
        description:
          "A neutral, open-ended next question. Never name a tribe or telegraph a 'right' answer.",
      },
    },
    required: ["deltas", "nextQuestion"],
  },
};

export interface ScoreAnswerInput {
  /** The question currently shown to the participant. */
  question: string;
  /** The participant's free-text answer to that question. */
  answer: string;
  /** Completed Turns so far, oldest first, for conversational context. */
  history: InterviewTurn[];
}

export interface ScoreAnswerResult {
  deltas: ScoredDelta[];
  nextQuestion: string;
}

let client: Anthropic | null = null;

/** Lazily construct the client so importing this module never requires the key. */
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. See .env.example.");
  }
  client ??= new Anthropic();
  return client;
}

const MARKER_TYPE_SET = new Set<string>(MARKER_TYPES);

/** Coerce the tool payload into validated ScoredDelta[] (defence-in-depth beyond strict mode). */
function parseDeltas(raw: unknown): ScoredDelta[] {
  if (!Array.isArray(raw)) return [];
  const deltas: ScoredDelta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.markerId !== "string" || typeof r.tribeSlug !== "string") continue;
    if (typeof r.type !== "string" || !MARKER_TYPE_SET.has(r.type)) continue;
    if (typeof r.delta !== "number") continue;
    deltas.push({
      markerId: r.markerId,
      tribeSlug: r.tribeSlug,
      type: r.type as MarkerType,
      delta: r.delta,
      postureSignal: typeof r.postureSignal === "number" ? r.postureSignal : 0,
    });
  }
  return deltas;
}

/** Render the conversation so far plus the answer to score into one user message. */
function buildTranscript(input: ScoreAnswerInput): string {
  const prior = input.history
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
    .join("\n\n");
  return (
    (prior ? `${prior}\n\n` : "") +
    `Current question: ${input.question}\n` +
    `Participant's answer: ${input.answer}\n\n` +
    `Score this answer against the Marker Catalog and choose the next question.`
  );
}

/**
 * Interpret and score one answer, and choose the next question — one Claude call
 * with forced tool use. The returned deltas are only *cited*; the pure scoring
 * engine (`scoring.ts`) validates them against the catalog before they affect
 * any score, so a hallucinated Marker id is dropped rather than trusted.
 */
export async function scoreAnswer(input: ScoreAnswerInput): Promise<ScoreAnswerResult> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    tools: [SCORING_TOOL],
    tool_choice: { type: "tool", name: SCORING_TOOL.name },
    messages: [{ role: "user", content: buildTranscript(input) }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === SCORING_TOOL.name,
  );
  if (!toolUse) {
    throw new Error("Interview agent did not return a scoring tool call.");
  }

  const payload = toolUse.input as { deltas?: unknown; nextQuestion?: unknown };
  const nextQuestion =
    typeof payload.nextQuestion === "string" && payload.nextQuestion.trim()
      ? payload.nextQuestion.trim()
      : "Tell me more about how you tend to show up when something matters to you.";

  return { deltas: parseDeltas(payload.deltas), nextQuestion };
}
