import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { MARKER_TYPES, markerCatalog } from "./markers";
import type { InterviewTurn, MarkerDelta, PostureSignal } from "./types";

/**
 * Interview agent client (glue) — the Anthropic SDK adapter that turns a
 * free-text answer into cited Marker deltas plus the next question, in one
 * tool-use call (ADR-0009: single agent per Turn, server-authoritative).
 *
 * `server-only`: the Marker Catalog and scoring rubric are the instrument's
 * rigor and must never reach the client (ADR-0009 trust boundary). The static
 * context (rubric + catalog + tribe profiles) is identical every Turn, so it is
 * sent as cached system blocks (prompt caching, ADR-0009); only the volatile
 * question/answer rides in the user turn.
 *
 * Scoring is constrained by construction (ADR-0003): the tool schema restricts
 * `markerId` to the catalogued ids, so the agent can only score by citing a real
 * Marker. The pure `score` engine re-validates and trusts the catalog over the
 * agent, so a hallucinated or mis-attributed citation still can't corrupt a
 * score.
 */

const MODEL = "claude-opus-4-8";
const TOOL_NAME = "score_answer";

const MARKER_IDS = markerCatalog.map((m) => m.id);
const TRIBE_SLUGS = tribes.map((t) => t.slug);
const POSTURE_SIGNALS: PostureSignal[] = ["active-shadow", "integrated", "neutral"];

/**
 * The rubric — how to read an answer and score it. Kept terse and stable so the
 * cached prefix never churns. The heavy lifting (which signals map to which
 * tribe) lives in the catalog below, not here (ADR-0003).
 */
const RUBRIC = `You are the scorer and interviewer for the Tribe Index Interview — a blind
instrument that infers how a person is wired across twelve archetypes from how
they talk about themselves, not from labels they pick.

You do two things each turn, in one tool call:

1. SCORE the participant's latest answer. Emit a Marker delta for every
   catalogued Marker whose signal genuinely resonates with what they said.
   - You may ONLY cite Marker ids from the catalog below. Never invent one.
   - "delta" is your confidence that the Marker's signal is present, from 0
     (absent) to 1 (unmistakable). Score on resonance with the theme, not on
     current dysfunction: someone describing how they have MATURED past a
     shadow or fall-line still resonates with that tribe — score it, and set
     "postureSignal" to "integrated". Score "active-shadow" when the tendency is
     live and unexamined, "neutral" for strengths/oil or when arc is unclear.
   - Read for the felt internal logic, not surface behavior. If an answer only
     conceptually describes a tribe without first-person emotional texture, do
     not fire its Markers.
   - It is fine to emit no deltas for an evasive or empty answer.

2. Choose the NEXT question. Open broad, then narrow toward whatever best
   separates the tribes the participant is gravitating toward. Keep it neutral,
   open-ended, and free of any hint about which tribe a given answer would
   score. One question, no preamble.`;

/** The catalog serialized for the model — every scorable Marker, verbatim. */
const CATALOG_CONTEXT = [
  "MARKER CATALOG (cite ids from here only):",
  ...markerCatalog.map(
    (m) =>
      `- ${m.id} [tribe=${m.tribeSlug}, type=${m.type}, weight=${m.weight}]: ${m.signal}`,
  ),
].join("\n");

/** Tribe essence + arc language, for context on what each Marker is reaching toward. */
const TRIBE_CONTEXT = [
  "TRIBES (for context — do not cite these, cite Markers):",
  ...tribes.map(
    (t) =>
      `- ${t.slug} (${t.name}, ${t.callSign}): ${t.essence}. Strengths: ${t.strengths} Shadow: ${t.shadowConstraints} Oil: ${t.oil} Fall line: ${t.fallLine}`,
  ),
].join("\n");

/**
 * The scoring tool. `strict` + enum-constrained ids/types/slugs guarantee the
 * agent returns exactly this shape and can only cite real Markers, so the parsed
 * payload validates without defensive parsing.
 */
const SCORE_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Record the Marker deltas scored from the participant's answer and the next question to ask.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      deltas: {
        type: "array",
        description: "One entry per catalogued Marker whose signal the answer resonates with. May be empty.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            markerId: { type: "string", enum: MARKER_IDS },
            tribeSlug: { type: "string", enum: TRIBE_SLUGS },
            type: { type: "string", enum: [...MARKER_TYPES] },
            delta: { type: "number", description: "Resonance confidence in [0,1]." },
            postureSignal: { type: "string", enum: POSTURE_SIGNALS },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
        },
      },
      nextQuestion: {
        type: "string",
        description: "The next question to ask the participant. Neutral, open-ended, no tribe hints.",
      },
    },
    required: ["deltas", "nextQuestion"],
  },
};

export interface ScoreAnswerInput {
  /** The question the participant was answering. */
  question: string;
  /** Their free-text answer. */
  answer: string;
  /** Prior completed turns, for conversational context. */
  history?: InterviewTurn[];
}

export interface ScoreAnswerResult {
  deltas: MarkerDelta[];
  nextQuestion: string;
}

/** Lazily construct the client so the API key is read at call time, not import. */
function client(): Anthropic {
  return new Anthropic();
}

function transcript(input: ScoreAnswerInput): string {
  const lines: string[] = [];
  for (const turn of input.history ?? []) {
    lines.push(`Interviewer: ${turn.question}`, `Participant: ${turn.answer}`, "");
  }
  lines.push(
    `Interviewer: ${input.question}`,
    `Participant: ${input.answer}`,
    "",
    "Score this latest answer and choose the next question.",
  );
  return lines.join("\n");
}

/**
 * Score one answer against the Marker Catalog and choose the next question.
 * Forces the `score_answer` tool so the response is always structured. Throws if
 * the model returns no tool call (surfaced to the caller — never silently
 * scores nothing).
 */
export async function scoreAnswer(
  input: ScoreAnswerInput,
): Promise<ScoreAnswerResult> {
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    // Static, identical every Turn → cached. The cache breakpoint sits on the
    // last system block, so rubric + catalog + tribes all cache together and
    // only the volatile transcript below is reprocessed (ADR-0009).
    system: [
      { type: "text", text: RUBRIC },
      { type: "text", text: TRIBE_CONTEXT },
      { type: "text", text: CATALOG_CONTEXT, cache_control: { type: "ephemeral" } },
    ],
    tools: [SCORE_TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: transcript(input) }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Interview agent returned no scoring tool call.");
  }

  const payload = toolUse.input as {
    deltas?: MarkerDelta[];
    nextQuestion?: string;
  };

  return {
    deltas: payload.deltas ?? [],
    nextQuestion: payload.nextQuestion?.trim() || "",
  };
}
