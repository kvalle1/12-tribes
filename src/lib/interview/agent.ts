import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { getMarkerById, markerCatalog } from "./markers";
import {
  POSTURE_SIGNALS,
  type MarkerDelta,
  type PostureSignal,
} from "./types";

/**
 * The scoring agent (ADR-0009): one server-side Claude call per Turn that reads
 * a free-text answer and returns per-tribe Marker deltas via tool-use
 * structured output. Scoring is *constrained* (ADR-0003) — the agent may only
 * score by citing catalogued Markers, and `validateScorePayload` reconciles
 * every returned delta against the Marker Catalog so a mislabelled or
 * hallucinated citation cannot move a score.
 *
 * `server-only` keeps the catalog, the prompt, and the API key off the client
 * (ADR-0009). The model call is isolated in `scoreAnswer`; the validation and
 * context-building are pure and unit-tested without touching the network.
 */

/**
 * Default to the current Opus (the skill's default). Overridable via env for
 * ops without a code change; the model does not affect the scoring contract,
 * which is enforced by `validateScorePayload` regardless of what the model
 * returns.
 */
const MODEL = process.env.INTERVIEW_MODEL ?? "claude-opus-5-5";

/** The structured-output contract: an array of cited Marker deltas. */
export const SCORE_TOOL: Anthropic.Tool = {
  name: "score_answer",
  description:
    "Record how the participant's answer scores against the Marker Catalog. " +
    "Emit one entry per Marker whose signal the answer genuinely resonates with; " +
    "cite the Marker by its exact id. Do not invent Markers or rationale.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["deltas"],
    properties: {
      deltas: {
        type: "array",
        description: "Zero or more scoring contributions, each citing one Marker.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
          properties: {
            markerId: {
              type: "string",
              description: "The exact id of the cited Marker from the catalog.",
            },
            tribeSlug: {
              type: "string",
              description: "The tribe the cited Marker scores toward.",
            },
            type: {
              type: "string",
              enum: ["strength", "oil", "shadow", "fallLine"],
              description: "The cited Marker's type.",
            },
            delta: {
              type: "number",
              description:
                "Strength contribution, 0 up to the Marker's weight. A matured " +
                "fall-line still contributes (resonance with the theme is evidence " +
                "of the tribe); never send a negative delta.",
            },
            postureSignal: {
              type: "string",
              enum: ["active-shadow", "neutral", "integrated"],
              description:
                "Where the answer places the participant on this tribe's fall→oil " +
                "arc: active-shadow, neutral, or integrated.",
            },
          },
        },
      },
    },
  },
};

/**
 * The static scoring context — rubric, Marker Catalog, and tribe profiles. It
 * repeats verbatim every Turn, so it is sent as cacheable `system` blocks with a
 * single cache breakpoint on the last block: the whole prefix is written once
 * and read cheaply on later Turns (ADR-0009 prompt caching). The volatile
 * answer goes in `messages`, after the cached prefix.
 */
export function buildScoringSystem(): Anthropic.TextBlockParam[] {
  const rubric = [
    "You are the scoring engine for the Tribe Index Interview.",
    "You read one free-text answer and score it against the Marker Catalog below.",
    "",
    "Rules (non-negotiable):",
    "- Score ONLY by citing a Marker from the catalog, by its exact id. Never invent a Marker or an ad-hoc rationale.",
    "- Emit a delta only when the answer genuinely resonates with a Marker's signal; an answer may match several Markers or none.",
    "- A delta is 0 up to the cited Marker's weight. Never send a negative delta.",
    "- A shadow or fall-line Marker fires on RESONANCE WITH THE THEME, not on current dysfunction. Someone who describes having matured past a tendency still resonates with it — score the Marker and set postureSignal to 'integrated'. Do not withhold or reduce the score for maturity.",
    "- Distinguish integrated (matured, first-person felt logic) from not-resonant (genuinely not this tribe).",
    "",
    "Return your scoring by calling the score_answer tool.",
  ].join("\n");

  const catalog = JSON.stringify(
    markerCatalog.map((m) => ({
      id: m.id,
      tribeSlug: m.tribeSlug,
      type: m.type,
      signal: m.signal,
      weight: m.weight,
      exemplar: m.exemplar,
      counterExemplar: m.counterExemplar,
    })),
  );

  const profiles = JSON.stringify(
    tribes.map((t) => ({
      slug: t.slug,
      name: t.name,
      essence: t.essence,
      strengths: t.strengths,
      oil: t.oil,
      shadow: t.shadowConstraints,
      fallLine: t.fallLine,
    })),
  );

  return [
    { type: "text", text: rubric },
    { type: "text", text: `Marker Catalog (JSON):\n${catalog}` },
    {
      type: "text",
      text: `Tribe profiles (JSON):\n${profiles}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function buildUserPrompt(question: string, answer: string): string {
  return [
    "Score this answer against the Marker Catalog by calling score_answer.",
    "",
    `Question: ${question}`,
    `Answer: ${answer}`,
  ].join("\n");
}

type RawDelta = {
  markerId?: unknown;
  delta?: unknown;
  postureSignal?: unknown;
};

function toPostureSignal(value: unknown): PostureSignal {
  return POSTURE_SIGNALS.includes(value as PostureSignal)
    ? (value as PostureSignal)
    : "neutral";
}

/**
 * Reconcile a raw tool-use payload against the Marker Catalog, dropping anything
 * that doesn't cite a real Marker and bounding every delta by that Marker's
 * weight (ADR-0003). `tribeSlug` and `type` are taken from the catalogued
 * Marker, never from the model, so a mislabelled citation cannot score the wrong
 * tribe. Pure and total: malformed input yields an empty array, never a throw.
 */
export function validateScorePayload(raw: unknown): MarkerDelta[] {
  if (typeof raw !== "object" || raw === null) return [];
  const deltas = (raw as { deltas?: unknown }).deltas;
  if (!Array.isArray(deltas)) return [];

  const validated: MarkerDelta[] = [];
  for (const entry of deltas) {
    if (typeof entry !== "object" || entry === null) continue;
    const { markerId, delta, postureSignal } = entry as RawDelta;
    if (typeof markerId !== "string") continue;

    const marker = getMarkerById(markerId);
    if (!marker) continue; // must cite a catalogued Marker

    const value = typeof delta === "number" && Number.isFinite(delta) ? delta : 0;
    const bounded = Math.min(Math.max(0, value), marker.weight);

    validated.push({
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      delta: bounded,
      postureSignal: toPostureSignal(postureSignal),
    });
  }
  return validated;
}

/** Lazily constructed so importing this module never requires an API key (builds, tests). */
let client: Anthropic | null = null;
function getClient(): Anthropic {
  return (client ??= new Anthropic());
}

/** A function that scores one answer into validated Marker deltas. Injectable for tests. */
export type ScoreAnswer = (input: {
  question: string;
  answer: string;
}) => Promise<MarkerDelta[]>;

/**
 * Score one answer with a single tool-use call. Thinking stays on (the model
 * default) and `tool_choice` is `auto` with the tool named in the prompt —
 * forced tool use is rejected on current models — so the call returns a
 * `score_answer` tool_use block, which `validateScorePayload` turns into
 * catalog-bounded deltas.
 */
export const scoreAnswer: ScoreAnswer = async ({ question, answer }) => {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildScoringSystem(),
    tools: [SCORE_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: buildUserPrompt(question, answer) }],
  });

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === SCORE_TOOL.name,
  );
  return block ? validateScorePayload(block.input) : [];
};
