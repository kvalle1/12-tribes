import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { tribes } from "@/lib/tribes";
import { markerCatalog } from "./markers";
import { parseScoringPayload } from "./scoring";
import type { ScoredDelta } from "./types";

/**
 * Interview agent client (glue) — the Anthropic SDK adapter for slice 3 (#16).
 *
 * Two server-only calls, one per responsibility:
 *   - `generateOpeningQuestion()` produces the neutral opening Turn (ADR-0009:
 *     the question is LLM-produced, replacing slice 1's hardcoded string).
 *   - `scoreAnswer()` interprets a free-text answer into per-Marker deltas via a
 *     tool-use structured payload, then hands the raw payload to the pure
 *     `parseScoringPayload` gate (ADR-0003) so only catalogued citations survive.
 *
 * The scoring call carries the Marker Catalog + rubric as a **prompt-cached**
 * system block (ADR-0009): it is byte-stable across Turns, so slice 4's
 * multi-Turn loop reads it from cache instead of re-billing it every Turn.
 *
 * `import "server-only"` keeps the catalog, the rubric, and the API key off the
 * client. The model defaults to the most capable Claude model and is overridable
 * per deployment via `INTERVIEW_MODEL`.
 */

const MODEL = process.env.INTERVIEW_MODEL ?? "claude-opus-5";

/** Lazily construct the client so a missing key fails only when a Turn runs, not at import. */
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — the Interview needs it to score answers (ADR-0009).",
    );
  }
  return new Anthropic();
}

/**
 * The rubric + Marker Catalog, rendered once at module load into a byte-stable
 * string so it caches across Turns. Grouped by tribe with each Marker's id,
 * type, weight, and signal — the agent may only cite ids that appear here.
 */
const STATIC_SYSTEM = buildStaticSystem();

function buildStaticSystem(): string {
  const bySlug = new Map<string, typeof markerCatalog[number][]>();
  for (const m of markerCatalog) {
    const list = bySlug.get(m.tribeSlug) ?? [];
    list.push(m);
    bySlug.set(m.tribeSlug, list);
  }

  const catalog = tribes
    .map((tribe) => {
      const lines = (bySlug.get(tribe.slug) ?? [])
        .map(
          (m) =>
            `  - ${m.id} [${m.type}, weight ${m.weight}]: ${m.signal}`,
        )
        .join("\n");
      return `### ${tribe.name} (slug: ${tribe.slug}) — ${tribe.essence}\n${lines}`;
    })
    .join("\n\n");

  return [
    "You are the scoring half of the Tribe Index Interview — a blind instrument that infers how a person is wired from how they talk about themselves.",
    "",
    "You score a participant's free-text answer against the Marker Catalog below. Rules you must not break:",
    "- You may ONLY score by citing a Marker id that appears in the catalog. Never invent a Marker, a tribe, or an ad-hoc rationale.",
    "- Each delta cites exactly one Marker and scores toward that Marker's tribe and type. `delta` is a NON-NEGATIVE number no greater than the Marker's weight, sized to how strongly the answer resonates with the signal (0 = no resonance; the full weight = unmistakable).",
    "- shadow and fallLine Markers are additive evidence OF the tribe — resonance with the theme raises strength; it never lowers it. Maturity past a fall-line is expressed by citing the tribe's OIL Marker with a positive postureSignal, never by a negative delta.",
    "- `postureSignal` is in [-1, 1]: negative means the answer shows the tribe in its active-shadow / fall posture, positive means an integrated / matured posture, 0 means neutral.",
    "- Only cite Markers the answer genuinely evidences. An answer may fire zero Markers; return an empty list rather than reaching.",
    "",
    "## Marker Catalog",
    "",
    catalog,
  ].join("\n");
}

const SCORING_TOOL: Anthropic.Tool = {
  name: "record_scoring",
  description:
    "Record the per-Marker strength deltas evidenced by the participant's answer. Every delta must cite a Marker id from the catalog in the system prompt; do not invent Markers or tribes. Call this exactly once.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      deltas: {
        type: "array",
        description:
          "One entry per Marker the answer evidences; empty if the answer evidences none.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            markerId: {
              type: "string",
              description: "A Marker id copied verbatim from the catalog.",
            },
            tribeSlug: {
              type: "string",
              description: "The tribe slug of the cited Marker.",
            },
            type: {
              type: "string",
              enum: ["strength", "oil", "shadow", "fallLine"],
              description: "The cited Marker's type.",
            },
            delta: {
              type: "number",
              description:
                "Non-negative strength contribution, no greater than the Marker's weight.",
            },
            postureSignal: {
              type: "number",
              description:
                "Posture nudge in [-1, 1]: negative = active-shadow, positive = integrated.",
            },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
        },
      },
    },
    required: ["deltas"],
  },
};

const OPENING_SYSTEM = [
  "You are the interviewer for the Tribe Index Interview — a warm, curious guide who reads how a person is wired from how they talk about themselves.",
  "Ask a single broad, open opening question that invites the participant to talk about a real, concrete experience in their own words.",
  "Keep it neutral: do not mention tribes, categories, strengths, or weaknesses, and do not telegraph any 'right' answer.",
  "Reply with ONLY the question text — no preamble, no quotation marks, no follow-up.",
].join("\n");

/** Produce the neutral opening question for a new Interview (ADR-0009). */
export async function generateOpeningQuestion(): Promise<string> {
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: OPENING_SYSTEM,
    messages: [
      { role: "user", content: "Begin the interview. Ask your opening question now." },
    ],
  });

  const text = message.content.find((block) => block.type === "text");
  if (!text || text.type !== "text" || !text.text.trim()) {
    throw new Error("The interviewer did not return an opening question.");
  }
  return text.text.trim();
}

/**
 * Score one answered Turn: interpret the free-text `answer` to `question`,
 * returning validated per-Marker deltas. The Marker Catalog + rubric ride in a
 * prompt-cached system block; the tool-use payload is validated by the pure
 * `parseScoringPayload` gate before it can touch any Session state.
 */
export async function scoreAnswer(
  question: string,
  answer: string,
): Promise<ScoredDelta[]> {
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: STATIC_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SCORING_TOOL],
    messages: [
      {
        role: "user",
        content: [
          `Question asked:\n${question}`,
          "",
          `Participant's answer:\n${answer}`,
          "",
          "Score this answer now by calling record_scoring exactly once. Cite only Markers the answer genuinely evidences.",
        ].join("\n"),
      },
    ],
  });

  const toolUse = message.content.find(
    (block) => block.type === "tool_use" && block.name === SCORING_TOOL.name,
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("The scorer did not return a record_scoring tool call.");
  }

  const input = toolUse.input as { deltas?: unknown };
  return parseScoringPayload(input.deltas);
}
