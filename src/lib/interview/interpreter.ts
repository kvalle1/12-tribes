import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { tribes } from "@/lib/tribes";
import { markerCatalog } from "./markers";
import type { InterviewTurn, MarkerDelta, MarkerType } from "./types";

/**
 * The Interview interpreter — the boundary where a free-text answer becomes
 * Marker-cited deltas (ADR 0003) and the next question (ADR 0005 / 0009).
 *
 * A single Claude call per Turn does both jobs: it interprets/scores the
 * participant's answer against the catalogued Markers *and* chooses the next
 * question. The structured payload comes back through a forced tool call so we
 * always get a machine-readable shape rather than parsing prose. The Marker
 * Catalog, tribe profiles, and rubric are sent in `system` with a
 * `cache_control: {type: "ephemeral"}` breakpoint (ADR 0009 → prompt caching)
 * because they repeat verbatim every Turn — only the message history varies.
 *
 * This module is **server-only** (ADR 0009): the catalog, prompts, and API key
 * must never reach the client, and importing this file into a client bundle is
 * a build error.
 *
 * The `LlmClient` seam is deliberate: unit tests inject a fake client that
 * returns a canned tool call, so the scoring / caching / validation contract is
 * exercised without a live API dependency (and without a network gate on CI).
 */

export class InterpreterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterpreterError";
  }
}

/**
 * The tool name Claude must call to return its structured decision. Exported so
 * tests can assert we forced this tool via `tool_choice`.
 */
export const SCORE_TOOL_NAME = "score_answer";

/** Default model — Opus 5 (the current-generation default per the API skill). */
export const DEFAULT_MODEL = "claude-opus-5";

/**
 * A tiny slice of the Anthropic SDK's Messages surface — just what the
 * interpreter needs. We depend on the shape rather than the concrete client so
 * tests can inject a fake and so a future switch (Bedrock, streaming) doesn't
 * ripple through the scoring logic.
 */
export interface LlmClient {
  create(params: Record<string, unknown>): Promise<{
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; name: string; input: unknown }
      | { type: string; [key: string]: unknown }
    >;
  }>;
}

export interface InterpreterOptions {
  /** Injectable seam for tests. Defaults to the real Anthropic SDK client. */
  client?: LlmClient;
  /** Model id — see the claude-api skill; defaults to Opus 5. */
  model?: string;
  /**
   * Upper bound on the response length. The structured payload is short (a
   * handful of deltas + one question), so this only needs headroom, not scale.
   */
  maxTokens?: number;
}

export interface ScoreAnswerInput {
  /** The question the participant was shown for this answer. */
  question: string;
  /** The participant's free-text answer. */
  answer: string;
  /**
   * Prior Turns in this Interview (oldest first), so the interpreter has
   * context for what the participant has already said this session.
   */
  priorTurns: readonly Pick<InterviewTurn, "question" | "answer">[];
}

export interface ScoreAnswerResult {
  /** Marker-cited deltas the participant's answer supports. */
  scored: MarkerDelta[];
  /**
   * The next question to show. Even at the single-Turn horizon (slice 3), we
   * store this to keep the shape stable for the multi-Turn loop in slice 4.
   */
  nextQuestion: string;
}

export interface Interpreter {
  /**
   * Produce the very first question of a fresh Session. Uses the same Claude
   * call shape as `scoreAnswer` — the cached prefix is identical, keeping the
   * cache hot from the first Turn onward.
   */
  openingQuestion(): Promise<string>;
  scoreAnswer(input: ScoreAnswerInput): Promise<ScoreAnswerResult>;
}

// ── Prompt construction ───────────────────────────────────────────────────

/**
 * The structured-output shape Claude must return, described as a tool schema.
 * `additionalProperties: false` + strict validation is enforced client-side by
 * filtering deltas whose ids don't exist in the catalog; we keep the schema
 * permissive on values (any string id, so unknown ids don't 400 the request)
 * so we degrade to "drop the bad delta" rather than losing the whole Turn.
 */
const MARKER_TYPES_SCHEMA: readonly MarkerType[] = [
  "strength",
  "oil",
  "shadow",
  "fallLine",
];

const SCORE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    scored: {
      type: "array",
      description:
        "The catalogued Markers this answer supports. Each delta must cite a real Marker id from the catalog above and echo its tribeSlug and type; ad-hoc scoring rationale is not permitted (ADR 0003).",
      items: {
        type: "object",
        properties: {
          markerId: {
            type: "string",
            description: "The Marker's stable id, exactly as it appears in the catalog.",
          },
          tribeSlug: {
            type: "string",
            description: "The tribe slug the Marker scores toward.",
          },
          type: {
            type: "string",
            enum: [...MARKER_TYPES_SCHEMA],
          },
          delta: {
            type: "number",
            description:
              "Non-negative contribution toward the cited tribe's strength. Bounded by MAX_DELTA_MULTIPLIER × Marker.weight; larger values are capped, not rejected.",
          },
          postureSignal: {
            type: "integer",
            enum: [-1, 0, 1],
            description:
              "Where on the fall→oil arc this answer places the participant for the cited tribe: +1 integrated, -1 active-shadow, 0 unresolved (ADR 0004). A matured fall-line routes to that tribe's oil Marker with +1, never to a fallLine Marker with a negative delta.",
          },
        },
        required: ["markerId", "tribeSlug", "type", "delta"],
      },
    },
    nextQuestion: {
      type: "string",
      description:
        "The next question to ask the participant. One clear, neutrally-phrased question — no compound asks, no leading language toward a target tribe.",
    },
  },
  required: ["scored", "nextQuestion"],
} as const;

/**
 * The static context sent verbatim every Turn — the Marker Catalog itself, a
 * distilled tribe primer, and the scoring rubric. Placed in `system` with a
 * cache_control breakpoint (ADR 0009) so subsequent Turns pay ~0.1× on this
 * prefix. It must render byte-identical between calls or the cache invalidates
 * — no timestamps, no per-request ids, no Set/Map iteration in this string.
 */
function staticSystemBlocks(): Anthropic.Messages.TextBlockParam[] {
  const catalogText = markerCatalog
    .map((m) => {
      const lines = [
        `- id: ${m.id}`,
        `  tribeSlug: ${m.tribeSlug}`,
        `  type: ${m.type}`,
        `  weight: ${m.weight}`,
        `  signal: ${m.signal}`,
      ];
      if (m.exemplar) lines.push(`  exemplar: ${m.exemplar}`);
      if (m.counterExemplar) lines.push(`  counterExemplar: ${m.counterExemplar}`);
      return lines.join("\n");
    })
    .join("\n");

  const tribePrimer = tribes
    .map((t) => `- ${t.slug} (${t.name}): ${t.essence}`)
    .join("\n");

  const preamble =
    "You are the interpreter for the Tribe Index Interview — a personality " +
    "instrument mapping people to the 12 biblical-tribe archetypes. You have " +
    "two jobs each turn: (1) score the participant's answer by citing " +
    "Markers from the catalog below; (2) choose the next question to ask.\n\n" +
    "Scoring rules (ADR 0003 / 0004 — non-negotiable):\n" +
    "  • You may ONLY score by citing a Marker id from the catalog. Do not " +
    "invent Markers, rationales, or ad-hoc scoring notes.\n" +
    "  • Every `delta` is non-negative. Fall-line and shadow Markers are " +
    "ADDITIVE on strength — resonance with a fall-line is evidence *of* the " +
    "tribe, not against it. Never return a negative delta.\n" +
    "  • A matured fall-line (the participant describes having grown past a " +
    "tendency): route to that tribe's `oil` Marker with `postureSignal: +1`. " +
    "Do NOT route to a `fallLine` Marker just to indicate maturity.\n" +
    "  • Weight your deltas near each cited Marker's authored `weight`. Larger " +
    "values are capped server-side.\n" +
    "  • The 12 tribes are all eligible, including disqualified ones (ADR 0007).\n\n" +
    "Question rules (ADR 0005 / 0008):\n" +
    "  • Ask one clear, neutrally phrased question at a time — no compound " +
    "asks, no leading language toward a target tribe.\n" +
    "  • Probe felt internal logic, not just observable behavior — the " +
    "first-person emotional texture is what distinguishes an integrated " +
    "tribe from one that simply isn't the participant's.\n\n" +
    "Return your decision by calling the `score_answer` tool. Do not respond " +
    "in prose.";

  return [
    { type: "text", text: preamble },
    {
      type: "text",
      text: `TRIBE PRIMER (slug — name — essence):\n${tribePrimer}`,
    },
    {
      type: "text",
      text: `MARKER CATALOG:\n${catalogText}`,
      // A single breakpoint at the end of the static context makes the whole
      // prefix cache-eligible in one go. The message history below varies each
      // Turn and does not need its own breakpoint yet.
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * Build the `messages` array for a Turn. Prior Turns render as
 * user→assistant pairs so Claude can see the history it's building on; the
 * current answer is the last user message. When called for an opening
 * question, `answer` is null and no history is threaded — the model sees only
 * the primer / catalog and is asked to open.
 */
function buildMessages(input: {
  priorTurns: readonly Pick<InterviewTurn, "question" | "answer">[];
  currentAnswer: { question: string; answer: string } | null;
}): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [];
  for (const turn of input.priorTurns) {
    messages.push({ role: "assistant", content: `Question: ${turn.question}` });
    messages.push({ role: "user", content: turn.answer });
  }
  if (input.currentAnswer) {
    messages.push({
      role: "assistant",
      content: `Question: ${input.currentAnswer.question}`,
    });
    messages.push({ role: "user", content: input.currentAnswer.answer });
  } else {
    messages.push({
      role: "user",
      content:
        "Begin the Interview. Return an empty `scored` array and set " +
        "`nextQuestion` to an opening question that touches broadly across the " +
        "tribes' themes without narrowing yet (calibration, not discrimination).",
    });
  }
  return messages;
}

// ── Response parsing ──────────────────────────────────────────────────────

const CATALOG_INDEX = new Map(markerCatalog.map((m) => [m.id, m]));

/**
 * Coerce the tool-call payload into typed `MarkerDelta` objects, dropping
 * anything that doesn't cite a real Marker or doesn't match its authored
 * tribeSlug/type. This is a defense in depth against a hallucinated payload —
 * `scoring.validateAndApplyDeltas` also validates — but doing it here means the
 * score trace we persist never records an invalid delta in the first place.
 */
function parseScored(input: unknown): MarkerDelta[] {
  if (!input || typeof input !== "object") return [];
  const raw = (input as { scored?: unknown }).scored;
  if (!Array.isArray(raw)) return [];

  const out: MarkerDelta[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const markerId = typeof rec.markerId === "string" ? rec.markerId : null;
    const marker = markerId ? CATALOG_INDEX.get(markerId) : undefined;
    if (!marker) continue;

    // The interpreter must echo the Marker's authored tribeSlug/type — anything
    // else is a hallucination we drop rather than trust.
    if (rec.tribeSlug !== marker.tribeSlug) continue;
    if (rec.type !== marker.type) continue;

    const delta = typeof rec.delta === "number" ? rec.delta : NaN;
    if (!Number.isFinite(delta) || delta < 0) continue;

    let postureSignal: -1 | 0 | 1 | undefined;
    if (rec.postureSignal === -1 || rec.postureSignal === 0 || rec.postureSignal === 1) {
      postureSignal = rec.postureSignal;
    }

    const item: MarkerDelta = {
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      delta,
    };
    if (postureSignal !== undefined) item.postureSignal = postureSignal;
    out.push(item);
  }
  return out;
}

function extractToolCall(
  response: Awaited<ReturnType<LlmClient["create"]>>,
): unknown {
  for (const block of response.content) {
    if (block.type === "tool_use" && (block as { name?: string }).name === SCORE_TOOL_NAME) {
      return (block as { input?: unknown }).input;
    }
  }
  throw new InterpreterError(
    `Interpreter response did not include a ${SCORE_TOOL_NAME} tool call.`,
  );
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * The lazily-constructed real client, wrapped in the tiny `LlmClient` shape.
 * Instantiated on first use so importing this module in a test context (where
 * `ANTHROPIC_API_KEY` may be absent) doesn't throw at import time.
 */
let defaultClient: LlmClient | null = null;
function realClient(): LlmClient {
  if (!defaultClient) {
    const anthropic = new Anthropic();
    defaultClient = {
      async create(params) {
        // The SDK accepts these params directly; the intermediate `unknown`
        // shape keeps the seam neutral for tests without pulling the SDK's
        // MessageCreateParams into every caller.
        return (await anthropic.messages.create(
          params as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming,
        )) as unknown as Awaited<ReturnType<LlmClient["create"]>>;
      },
    };
  }
  return defaultClient;
}

export function createInterpreter(options: InterpreterOptions = {}): Interpreter {
  const client = options.client ?? realClient();
  const model = options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? 1024;
  const system = staticSystemBlocks();

  const tools = [
    {
      name: SCORE_TOOL_NAME,
      description:
        "Return this Turn's structured decision: the Marker-cited deltas for " +
        "the current answer plus the next question to ask.",
      input_schema: SCORE_TOOL_SCHEMA,
    },
  ];

  async function callClaude(
    messages: Anthropic.Messages.MessageParam[],
  ): Promise<{ scored: MarkerDelta[]; nextQuestion: string }> {
    const response = await client.create({
      model,
      max_tokens: maxTokens,
      system,
      tools,
      tool_choice: { type: "tool", name: SCORE_TOOL_NAME },
      messages,
    });
    const input = extractToolCall(response);
    const scored = parseScored(input);
    const nextQuestion =
      input && typeof input === "object" && typeof (input as { nextQuestion?: unknown }).nextQuestion === "string"
        ? (input as { nextQuestion: string }).nextQuestion.trim()
        : "";
    if (!nextQuestion) {
      throw new InterpreterError(
        "Interpreter response did not include a nextQuestion.",
      );
    }
    return { scored, nextQuestion };
  }

  return {
    async openingQuestion() {
      const { nextQuestion } = await callClaude(
        buildMessages({ priorTurns: [], currentAnswer: null }),
      );
      return nextQuestion;
    },
    async scoreAnswer(input) {
      return callClaude(
        buildMessages({
          priorTurns: input.priorTurns,
          currentAnswer: { question: input.question, answer: input.answer },
        }),
      );
    },
  };
}
