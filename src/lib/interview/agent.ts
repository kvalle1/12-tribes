import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { MARKER_TYPES, markerCatalog } from "./markers";
import { POSTURE_SIGNALS, validateScoredDeltas, type RawScoredDelta } from "./scoring";
import type { ScoredDelta } from "./types";

/**
 * The per-Turn scoring agent (ADR-0009): one Anthropic call that interprets a
 * free-text answer and returns per-tribe Marker deltas via tool-use structured
 * output. Scoring runs on the server only — this module is `server-only` and the
 * Marker Catalog it sends never reaches the client.
 *
 * The agent's freedom is asymmetric (ADR-0003): it may read the whole catalog,
 * but it may only *score* by citing Markers from it. The model's output is
 * therefore untrusted — `validateScoredDeltas` reconciles every delta against
 * the catalog downstream, so a hallucinated Marker id or an inflated weight
 * can never corrupt the profile.
 *
 * Static context (rubric + tribe roster + Marker Catalog) is identical every
 * Turn, so it is sent as cached `system` blocks (ADR-0009 prompt caching); only
 * the question and answer vary, and they go in `messages` after the cached
 * prefix. The request builder and the response parser are pure and exported so
 * the wiring can be tested without a live model.
 */

/** The model used to score answers. Overridable for evals; defaults to Opus. */
export const SCORING_MODEL = process.env.INTERVIEW_MODEL ?? "claude-opus-5-5";

export const SCORING_TOOL_NAME = "record_scoring";

/** Minimal structural client so tests can inject a fake in place of the SDK. */
export interface ScoringModelClient {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
    ): Promise<Anthropic.Message>;
  };
}

const RUBRIC = `You are the scoring engine for a blind personality interview that maps a person to biblical-tribe archetypes. You read ONE free-text answer and report which catalogued Markers it evidences.

Hard rules:
- Score ONLY by citing Markers from the Marker Catalog below, by their exact "id". Never invent a Marker or an ad-hoc rationale. If an answer evidences nothing in the catalog, return an empty "deltas" list.
- For each cited Marker, "delta" is how strongly this answer evidences that Marker's signal, from 0 up to the Marker's "weight". Use the full range; a faint or incidental hint is a small delta.
- Markers of every type — strength, oil, shadow, fallLine — ADD to a tribe's strength. A shadow or fall-line signal is still evidence the person is wired for that tribe; it never lowers a tribe.
- A fall-line Marker fires on RESONANCE WITH THE THEME, not on current dysfunction. If the person describes having matured past that tendency, that is still evidence of the tribe: cite the tribe's "oil" Marker instead and set "postureSignal" to "integrated". Distinguish genuine maturity (felt, first-person emotional texture) from the pattern simply not being theirs (detached, third-person) — the latter scores nothing.
- "postureSignal" places the answer on the tribe's fall→oil arc for this Marker: "active-shadow" (living in the shadow/fall now), "integrated" (matured past it), or "neutral" (not indicated).

Call the ${SCORING_TOOL_NAME} tool exactly once with your deltas. Do not reply with prose.`;

function tribeRoster(): string {
  return tribes
    .map((t) => `- ${t.slug} — ${t.name} (${t.callSign}): ${t.essence}`)
    .join("\n");
}

function catalogForPrompt(): string {
  return JSON.stringify(
    markerCatalog.map((m) => ({
      id: m.id,
      tribeSlug: m.tribeSlug,
      type: m.type,
      weight: m.weight,
      signal: m.signal,
      ...(m.exemplar ? { exemplar: m.exemplar } : {}),
      ...(m.counterExemplar ? { counterExemplar: m.counterExemplar } : {}),
    })),
    null,
    2,
  );
}

/** The static, cacheable `system` context — identical on every Turn. */
function systemBlocks(): Anthropic.TextBlockParam[] {
  return [
    { type: "text", text: RUBRIC },
    { type: "text", text: `Tribe roster (slug — name):\n${tribeRoster()}` },
    {
      type: "text",
      text: `Marker Catalog (JSON):\n${catalogForPrompt()}`,
      // Cache the whole tools+system prefix; it repeats every Turn (ADR-0009).
      cache_control: { type: "ephemeral" },
    },
  ];
}

const scoringTool: Anthropic.Tool = {
  name: SCORING_TOOL_NAME,
  description:
    "Record the Marker deltas evidenced by the participant's answer. Every delta must cite a Marker id from the catalog.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      deltas: {
        type: "array",
        description:
          "One entry per catalogued Marker the answer evidences. Empty if the answer evidences nothing in the catalog.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            markerId: {
              type: "string",
              description: "Exact Marker id from the catalog.",
            },
            tribeSlug: {
              type: "string",
              description: "The Marker's tribe slug (as in the catalog).",
            },
            type: { type: "string", enum: [...MARKER_TYPES] },
            delta: {
              type: "number",
              description: "Strength of evidence, 0 up to the Marker's weight.",
            },
            postureSignal: { type: "string", enum: [...POSTURE_SIGNALS] },
          },
          required: ["markerId", "tribeSlug", "type", "delta", "postureSignal"],
        },
      },
    },
    required: ["deltas"],
  },
};

export interface ScoreAnswerInput {
  question: string;
  answer: string;
}

/** Build the (deterministic, cacheable) request for scoring one answer. */
export function buildScoringRequest(
  input: ScoreAnswerInput,
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: SCORING_MODEL,
    max_tokens: 4096,
    system: systemBlocks(),
    tools: [scoringTool],
    // Opus 5.5 rejects forced tool_choice; the rubric instructs the single call.
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `Question asked:\n${input.question}\n\nParticipant's answer:\n${input.answer}`,
      },
    ],
  };
}

/** Pull the raw deltas out of the model's `record_scoring` tool call, if any. */
export function parseScoringMessage(message: Anthropic.Message): RawScoredDelta[] {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === SCORING_TOOL_NAME) {
      const input = block.input as { deltas?: unknown };
      if (Array.isArray(input.deltas)) {
        return input.deltas as RawScoredDelta[];
      }
      return [];
    }
  }
  return [];
}

let cachedClient: Anthropic | null = null;
function defaultClient(): ScoringModelClient {
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

/**
 * Score one answer: call the model, extract its cited deltas, and constrain them
 * to the catalog. The returned deltas are already validated (unknown Markers
 * dropped, weights clamped, fields reconciled), ready to fold into the profile.
 */
export async function scoreAnswer(
  input: ScoreAnswerInput,
  deps: { client?: ScoringModelClient } = {},
): Promise<ScoredDelta[]> {
  const client = deps.client ?? defaultClient();
  const message = await client.messages.create(buildScoringRequest(input));
  const raw = parseScoringMessage(message);
  return validateScoredDeltas(raw, markerCatalog);
}
