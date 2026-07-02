import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { markerCatalog, MARKER_TYPES } from "./markers";
import { catalogMarkerIds } from "./scoring";
import type { InterviewTurn, ScoredDelta } from "./types";

/**
 * Interview agent client — the glue between the pure Scoring engine and Claude
 * (ADR-0009: server-authoritative, single Claude call per Turn via the Anthropic
 * SDK using tool-use for structured output).
 *
 * This module is **server-only**. It holds the API key, the Marker Catalog, and
 * the scoring rubric, none of which may reach the client (ADR-0009 trust
 * boundary). One call both interprets/scores the answer (returning cited Marker
 * deltas) and chooses the next question. The static context — catalog signals,
 * tribe essences, rubric — repeats every Turn and is sent with **prompt
 * caching** so per-Turn cost and latency stay low.
 *
 * Scoring is constrained to catalogued Markers (ADR-0003): the tool schema is
 * `strict`, and any delta citing an unknown Marker id is dropped server-side by
 * the Scoring engine — the agent's freedom is asymmetric by design (free to ask
 * anything, constrained in what it may score).
 */

const MODEL = "claude-opus-4-8";

/** The scoring tool's name — forced via `tool_choice` so every Turn scores. */
const SCORING_TOOL = "record_scoring";

export interface AgentTurnResult {
  /** Cited Marker deltas for the answer (validated/applied by the engine). */
  deltas: ScoredDelta[];
  /** The next open-ended question to ask (neutral, non-leading). */
  nextQuestion: string;
}

export class InterviewAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterviewAgentError";
  }
}

/**
 * The static context, built once at module load (deterministic — no timestamps
 * or per-request ids) so the cached prefix is byte-stable across Turns. Renders
 * the full Marker Catalog (id, tribe, type, signal) plus each tribe's essence
 * and the scoring rubric. Order: rubric → tribes → catalog, all frozen.
 */
const STATIC_CONTEXT = buildStaticContext();

function buildStaticContext(): string {
  const tribeLines = tribes
    .map((t) => `- ${t.slug} (${t.name}) — ${t.essence}`)
    .join("\n");

  const markerLines = markerCatalog
    .map(
      (m) =>
        `- ${m.id} [tribe: ${m.tribeSlug}, type: ${m.type}] — ${m.signal}` +
        (m.exemplar ? ` (e.g. ${m.exemplar})` : ""),
    )
    .join("\n");

  return [
    "You are the interviewer and scorer for the Tribe Index Interview, a blind",
    "instrument that infers how a person is wired from how they talk about",
    "themselves. You do two things each turn: score the participant's answer",
    "against the Marker Catalog, and choose the next question.",
    "",
    "# Scoring rubric",
    "- You may ONLY score by citing a Marker `id` from the catalog below. Never",
    "  invent a marker or rationale. If an answer evidences no catalogued marker,",
    "  return an empty `deltas` list.",
    "- For each marker the answer evidences, emit one delta with that marker's",
    "  exact `id`, `tribeSlug`, and `type` (copied verbatim from the catalog),",
    "  plus `delta` (0–1: how strongly the answer evidences it) and",
    "  `postureSignal` (-1 active-shadow … +1 integrated: where on the fall→oil",
    "  arc the person sits for this theme).",
    "- A fall-line or shadow marker fires on RESONANCE with the theme, not on",
    "  current dysfunction. Someone who describes having matured past a tendency",
    "  still resonates with it — score it; the postureSignal, not the delta,",
    "  carries their integration.",
    "",
    "# Choosing the next question",
    "- Ask ONE open-ended, neutral question in the participant's own terms. Do",
    "  not telegraph which tribe a 'right' answer belongs to or name tribes.",
    "",
    "# Tribes",
    tribeLines,
    "",
    "# Marker Catalog",
    markerLines,
  ].join("\n");
}

/** The strict tool schema Claude must fill — the structured scoring payload. */
const SCORING_TOOL_DEF: Anthropic.Tool = {
  name: SCORING_TOOL,
  description:
    "Record the Marker deltas evidenced by the participant's answer and the " +
    "next question to ask. Cite only catalogued Marker ids.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      deltas: {
        type: "array",
        description: "Marker deltas evidenced by this answer (may be empty).",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            markerId: { type: "string", description: "A Marker id from the catalog." },
            tribeSlug: { type: "string" },
            type: { type: "string", enum: [...MARKER_TYPES] },
            delta: {
              type: "number",
              description: "0–1: how strongly the answer evidences this Marker.",
            },
            postureSignal: {
              type: "number",
              description: "-1 (active-shadow) … +1 (integrated) for this theme.",
            },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
        },
      },
      nextQuestion: {
        type: "string",
        description: "The next open-ended, neutral question to ask.",
      },
    },
    required: ["deltas", "nextQuestion"],
  },
  strict: true,
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new InterviewAgentError(
      "ANTHROPIC_API_KEY is not set — the Interview cannot score answers.",
    );
  }
  client ??= new Anthropic();
  return client;
}

/**
 * Score one free-text answer against the Marker Catalog and choose the next
 * question, in a single Claude call. Returns the raw cited deltas — the pure
 * Scoring engine validates and applies them (an uncatalogued or mis-cited delta
 * is dropped there, so this layer stays a thin adapter).
 */
export async function scoreAnswer(input: {
  question: string;
  answer: string;
  priorTurns: readonly InterviewTurn[];
}): Promise<AgentTurnResult> {
  const priorContext = input.priorTurns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
    .join("\n\n");

  const userText = [
    priorContext ? `Earlier in the interview:\n${priorContext}\n` : "",
    `Current question: ${input.question}`,
    `Participant's answer: ${input.answer}`,
    "",
    "Score this answer against the Marker Catalog and choose the next question.",
  ]
    .filter(Boolean)
    .join("\n");

  let message: Anthropic.Message;
  try {
    message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      // Thinking is omitted (Opus 4.8 runs without it when unset) so we can
      // force `tool_choice` and guarantee a structured scoring payload every
      // Turn — reliability of the constrained extraction matters more here than
      // free-form reasoning. Static context is frozen and sent first, cached
      // across Turns (ADR-0009); the volatile answer goes after the cached prefix.
      system: [
        {
          type: "text",
          text: STATIC_CONTEXT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [SCORING_TOOL_DEF],
      tool_choice: { type: "tool", name: SCORING_TOOL },
      messages: [{ role: "user", content: userText }],
    });
  } catch (err) {
    throw new InterviewAgentError(
      `Claude scoring call failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === SCORING_TOOL,
  );
  if (!toolUse) {
    throw new InterviewAgentError("Claude did not return a scoring tool call.");
  }

  return normalize(toolUse.input);
}

/**
 * Defensively coerce the tool payload into the `AgentTurnResult` shape. `strict`
 * tool use guarantees the schema, but this layer still filters to catalogued
 * Marker ids so a malformed id never reaches the engine, and guarantees a
 * non-empty next question.
 */
function normalize(raw: unknown): AgentTurnResult {
  const payload = (raw ?? {}) as {
    deltas?: unknown;
    nextQuestion?: unknown;
  };

  const rawDeltas = Array.isArray(payload.deltas) ? payload.deltas : [];
  const deltas: ScoredDelta[] = [];
  for (const d of rawDeltas) {
    if (!d || typeof d !== "object") continue;
    const { markerId, tribeSlug, type, delta, postureSignal } = d as Record<
      string,
      unknown
    >;
    if (typeof markerId !== "string" || !catalogMarkerIds.has(markerId)) continue;
    deltas.push({
      markerId,
      tribeSlug: String(tribeSlug ?? ""),
      type: type as ScoredDelta["type"],
      delta: typeof delta === "number" ? delta : 0,
      postureSignal: typeof postureSignal === "number" ? postureSignal : 0,
    });
  }

  const nextQuestion =
    typeof payload.nextQuestion === "string" && payload.nextQuestion.trim()
      ? payload.nextQuestion.trim()
      : FALLBACK_QUESTION;

  return { deltas, nextQuestion };
}

/** Used only if the model omits a next question — keeps the flow moving. */
const FALLBACK_QUESTION =
  "Tell me about a moment when you felt most alive and effective. What were you doing, and why did it land that way?";
