import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { tribes } from "@/lib/tribes";
import { getMarkerById, markerCatalog } from "./markers";
import type { PostureSignal, ScoreDelta } from "./types";

/**
 * Interview agent client (slice #16) — the glue between a free-text answer and
 * the pure scoring engine.
 *
 * One Claude call per answer, using **tool-use for structured output**: the model
 * interprets the answer and returns per-tribe Marker deltas plus the next
 * question (ADR-0009). Scoring is **Marker-constrained** — the model may only
 * cite Marker ids from the catalog, and `tribeSlug`/`type` are taken from the
 * catalog rather than trusted from the model, so it cannot invent rationale
 * (ADR-0003). The static context (Marker Catalog, tribe profiles, rubric) is
 * sent once with **prompt caching** since it repeats every Turn.
 *
 * This module is `server-only`: the catalog, the scoring rubric, and the API key
 * never reach the client (ADR-0009 trust boundary). Only `parseScoringPayload`
 * is pure and unit-tested; the network call is exercised by running the app.
 */

/** The tool the model must call — the structured scoring payload contract. */
const SCORING_TOOL_NAME = "record_scoring";

/**
 * The model is configurable so operations can tune cost/latency for a call that
 * runs many times per interview. Kept out of source as a literal and read from
 * the environment; see `.env.example` for the default.
 */
const MODEL = process.env.INTERVIEW_MODEL ?? "claude-sonnet-5";

export interface ScoringPayload {
  /** Validated, Marker-constrained deltas ready for the scoring engine. */
  deltas: ScoreDelta[];
  /** The next question the model proposed, if any (used from slice #17 onward). */
  nextQuestion: string | null;
}

const POSTURE_SIGNALS: readonly PostureSignal[] = [
  "active-shadow",
  "integrated",
  "neutral",
];

/**
 * Turn a raw tool-use payload into validated, Marker-constrained deltas.
 *
 * Pure and defensive: every delta must cite a real catalogued Marker or it is
 * dropped. `tribeSlug` and `type` are taken from the catalog (not the model), and
 * the magnitude is clamped to `(0, marker.weight]` so a single answer can never
 * score a tribe beyond the Marker's bounded weight. This is where the scoring
 * contract is enforced regardless of what the model emits.
 */
export function parseScoringPayload(raw: unknown): ScoringPayload {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const rawDeltas = Array.isArray(obj.deltas) ? obj.deltas : [];
  const deltas: ScoreDelta[] = [];
  for (const entry of rawDeltas) {
    if (!entry || typeof entry !== "object") continue;
    const d = entry as Record<string, unknown>;

    const markerId = typeof d.markerId === "string" ? d.markerId : null;
    if (!markerId) continue;
    const marker = getMarkerById(markerId);
    if (!marker) continue; // must cite a catalogued Marker (ADR-0003)

    const proposed =
      typeof d.delta === "number" && Number.isFinite(d.delta) ? d.delta : marker.weight;
    // Bound the contribution to the Marker's weight; negatives become 0.
    const delta = Math.max(0, Math.min(proposed, marker.weight));

    const postureSignal: PostureSignal = POSTURE_SIGNALS.includes(
      d.postureSignal as PostureSignal,
    )
      ? (d.postureSignal as PostureSignal)
      : "neutral";

    deltas.push({
      markerId,
      tribeSlug: marker.tribeSlug, // authoritative from the catalog
      type: marker.type, // authoritative from the catalog
      delta,
      postureSignal,
    });
  }

  const nextQuestion =
    typeof obj.nextQuestion === "string" && obj.nextQuestion.trim()
      ? obj.nextQuestion.trim()
      : null;

  return { deltas, nextQuestion };
}

/**
 * The static context sent every Turn: the Marker Catalog the model scores
 * against, the tribes it maps to, and the scoring rubric. Deterministic (no
 * timestamps/ids) so the prompt cache prefix stays stable across Turns.
 */
const SYSTEM_CONTEXT = buildSystemContext();

function buildSystemContext(): string {
  const tribeLines = tribes
    .map((t) => `- ${t.slug} · ${t.name} — ${t.essence}`)
    .join("\n");

  const markerLines = markerCatalog
    .map(
      (m) =>
        `- ${m.id} [${m.tribeSlug} · ${m.type} · weight ${m.weight}] ${m.signal}`,
    )
    .join("\n");

  return [
    "You are the scoring engine for the Tribe Index Interview — a blind instrument that infers how a person is wired from how they talk about themselves.",
    "",
    "Your job: read the participant's answer and record every Marker it provides genuine evidence for, then propose a natural next question.",
    "",
    "RUBRIC (follow exactly):",
    "- Score ONLY by citing Marker ids from the catalog below. Never invent a Marker or a rationale that isn't anchored to one.",
    "- A Marker fires on resonance with its signal, not on surface keywords. First-person, felt experience counts; abstract third-person description does not.",
    "- shadow and fall-line Markers are evidence OF the tribe and add to its strength — never treat maturity past a weakness as absence of the tribe.",
    "- Set `delta` between 0 and the Marker's weight, reflecting how strongly the answer evidences it.",
    "- Set `postureSignal` to `active-shadow` when the tendency is live/unintegrated, `integrated` when they describe having matured past it, else `neutral`.",
    "- Cite only Markers with real support. An answer may fire zero Markers; that is fine.",
    "",
    "TRIBES:",
    tribeLines,
    "",
    "MARKER CATALOG:",
    markerLines,
  ].join("\n");
}

/** The tool-use schema the model must fill — the structured scoring payload. */
const SCORING_TOOL: Anthropic.Tool = {
  name: SCORING_TOOL_NAME,
  description:
    "Record the Marker evidence found in the participant's answer and the next question to ask. Cite only Marker ids from the catalog.",
  input_schema: {
    type: "object",
    properties: {
      deltas: {
        type: "array",
        description: "One entry per Marker the answer genuinely evidences; may be empty.",
        items: {
          type: "object",
          properties: {
            markerId: {
              type: "string",
              description: "A Marker id from the catalog, e.g. 'judah-strength-front'.",
            },
            tribeSlug: { type: "string", description: "The Marker's tribe slug." },
            type: {
              type: "string",
              enum: ["strength", "oil", "shadow", "fallLine"],
            },
            delta: {
              type: "number",
              description: "Strength contribution, between 0 and the Marker's weight.",
            },
            postureSignal: {
              type: "string",
              enum: ["active-shadow", "integrated", "neutral"],
            },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
        },
      },
      nextQuestion: {
        type: "string",
        description: "A natural, neutrally-phrased next question for the participant.",
      },
    },
    required: ["deltas", "nextQuestion"],
  },
};

let client: Anthropic | null = null;

/** Lazily construct the client so a missing key doesn't break the build/import. */
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. See .env.example.");
  }
  return (client ??= new Anthropic());
}

/**
 * Score one free-text answer against the Marker Catalog. Returns validated,
 * Marker-constrained deltas (ready for the scoring engine) plus the model's
 * proposed next question. The static context is prompt-cached across Turns.
 */
export async function scoreAnswer(
  question: string,
  answer: string,
): Promise<ScoringPayload> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_CONTEXT,
        // Cache the (large, stable) catalog+rubric prefix; it repeats every Turn.
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SCORING_TOOL],
    tool_choice: { type: "tool", name: SCORING_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Question asked:\n${question}\n\nParticipant's answer:\n${answer}\n\nScore this answer by citing Markers from the catalog.`,
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { deltas: [], nextQuestion: null };
  }
  return parseScoringPayload(toolUse.input);
}
