import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { tribes } from "@/lib/tribes";
import { MARKER_TYPES, markerCatalog } from "./markers";
import type { MarkerDelta } from "./types";
import type { MarkerType } from "./markers";

/**
 * The Interview scoring agent (slice #16) — the one glue seam between a free-text
 * answer and the pure scoring engine.
 *
 * A single Claude call (Anthropic SDK, tool-use structured output) reads an
 * answer and returns the Marker deltas it provides evidence for, each citing a
 * catalogued Marker id (ADR-0003). The heavy, unchanging context — the scoring
 * rubric, the full Marker Catalog, and the tribe essences — is sent as a
 * prompt-cached system prefix so only the short per-answer turn is billed at full
 * rate across Turns (ADR-0009). Scoring itself is applied by `scoring.ts`; this
 * module only obtains and shapes the model's cited deltas.
 *
 * `server-only`: the catalog and the model call never reach the client.
 */

/** The app defaults to Opus 4.8 (CLAUDE.md model identity); scoring rides the same tier. */
const INTERVIEW_MODEL = "claude-opus-4-8";

export interface ScoredAnswer {
  /** The Marker deltas the agent read from the answer (validated shape; may be empty). */
  deltas: MarkerDelta[];
  /** A neutral follow-up question — unused this slice, seeds the multi-Turn loop (#17). */
  nextQuestion: string;
}

/** The scoring rubric — the standing instructions, stable across every Turn. */
const RUBRIC = `You are the scorer for the Tribe Index Interview. You read one free-text answer a participant gave and decide which catalogued Markers it provides genuine evidence for.

Rules:
- You may ONLY cite Markers from the catalog below, by their exact id. Never invent a Marker, and never score with a rationale that isn't a catalogued Marker.
- For each Marker you cite, give a delta in [0,1] for how strongly the answer matches that Marker's signal (0 = no evidence, 1 = unmistakable). Cite the tribeSlug and type exactly as they appear in the catalog.
- Shadow and fall-line Markers are still evidence that the person IS that tribe — cite them additively, as positive deltas. Never use them to argue against a tribe.
- Cite only Markers with real support in the answer. It is completely fine to return few Markers, or none, for a thin answer.
- Also propose one neutral, non-leading follow-up question that does not telegraph any tribe.

Record everything through the record_scoring tool.`;

/**
 * The Marker Catalog rendered for the prompt — id, tribe, type, and signal per
 * line, plus the authored exemplar / counter-exemplar snippets that anchor what
 * the Marker looks like when present and the near-miss that should NOT fire it.
 * This is the bulk of the cached prefix.
 */
const CATALOG_TEXT = markerCatalog
  .map((m) => {
    let line = `- ${m.id} [tribe=${m.tribeSlug} type=${m.type}] ${m.signal}`;
    if (m.exemplar) line += `\n    fires when: ${m.exemplar}`;
    if (m.counterExemplar) line += `\n    does NOT fire: ${m.counterExemplar}`;
    return line;
  })
  .join("\n");

/** The 12 tribe essences, so the model reads Markers in the context of each tribe. */
const TRIBE_TEXT = tribes
  .map((t) => `- ${t.slug} (${t.name}): ${t.essence}`)
  .join("\n");

/** The full static context, cached as a prefix so per-Turn cost stays low (ADR-0009). */
const STATIC_CONTEXT = `Tribes:\n${TRIBE_TEXT}\n\nMarker Catalog:\n${CATALOG_TEXT}`;

/** The structured-output tool the model must call to report cited Marker deltas. */
const SCORING_TOOL: Anthropic.Tool = {
  name: "record_scoring",
  description:
    "Record the Marker evidence found in the participant's answer, plus one neutral follow-up question.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      deltas: {
        type: "array",
        description:
          "The cited Marker deltas. Only Markers present in the catalog; use [] when the answer shows none.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            markerId: { type: "string", description: "Exact id of a catalogued Marker." },
            tribeSlug: { type: "string", description: "The cited Marker's tribe slug." },
            type: { type: "string", enum: [...MARKER_TYPES] },
            delta: { type: "number", description: "Match strength in [0,1]." },
            postureSignal: {
              type: "string",
              description:
                "Optional: where on the fall→oil arc the answer sits (active-shadow … integrated).",
            },
          },
          required: ["markerId", "tribeSlug", "type", "delta"],
        },
      },
      nextQuestion: {
        type: "string",
        description: "One neutral, non-leading follow-up question.",
      },
    },
    required: ["deltas", "nextQuestion"],
  },
};

/** Coerce the tool payload's `deltas` into well-formed MarkerDeltas, dropping junk. */
function parseDeltas(raw: unknown): MarkerDelta[] {
  if (!Array.isArray(raw)) return [];
  const deltas: MarkerDelta[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { markerId, tribeSlug, type, delta, postureSignal } = item as Record<string, unknown>;

    if (typeof markerId !== "string" || typeof tribeSlug !== "string") continue;
    if (typeof type !== "string" || !MARKER_TYPES.includes(type as MarkerType)) continue;
    if (typeof delta !== "number" || !Number.isFinite(delta)) continue;

    deltas.push({
      markerId,
      tribeSlug,
      type: type as MarkerType,
      delta,
      ...(typeof postureSignal === "string" ? { postureSignal } : {}),
    });
  }

  return deltas;
}

/**
 * Score one answer against the Marker Catalog via a forced tool-use call.
 *
 * Returns the cited deltas (whose final scoring integrity — unknown/misattributed
 * Markers dropped — is enforced downstream by `applyScoring`) and a follow-up
 * question. Throws only when the model returns no tool call at all; the caller
 * decides how to degrade.
 */
export async function scoreAnswer(question: string, answer: string): Promise<ScoredAnswer> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: INTERVIEW_MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: RUBRIC },
      // Cache breakpoint on the last (largest) static block: caches the tools +
      // both system blocks. The volatile answer rides in `messages`, uncached.
      { type: "text", text: STATIC_CONTEXT, cache_control: { type: "ephemeral" } },
    ],
    tools: [SCORING_TOOL],
    tool_choice: { type: "tool", name: "record_scoring" },
    messages: [
      {
        role: "user",
        content: `Question asked:\n${question}\n\nParticipant's answer:\n${answer}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "record_scoring",
  );
  if (!toolUse) {
    throw new Error("Interview scorer did not return a record_scoring tool call.");
  }

  const input = toolUse.input as { deltas?: unknown; nextQuestion?: unknown };
  return {
    deltas: parseDeltas(input.deltas),
    nextQuestion: typeof input.nextQuestion === "string" ? input.nextQuestion : "",
  };
}
