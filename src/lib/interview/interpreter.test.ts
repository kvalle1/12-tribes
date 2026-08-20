import { describe, expect, it, vi } from "vitest";
import { markerCatalog } from "./markers";
import {
  InterpreterError,
  SCORE_TOOL_NAME,
  createInterpreter,
  type LlmClient,
} from "./interpreter";

const judahStrength = markerCatalog.find((m) => m.id === "judah-strength-front")!;

/**
 * Build a fake LLM client whose `create` returns a canned response, so tests
 * exercise the interpreter's parsing / validation / caching without a live API.
 */
function fakeClient(
  payload: {
    scored?: Array<{
      markerId: string;
      tribeSlug: string;
      type: string;
      delta: number;
      postureSignal?: number;
    }>;
    nextQuestion?: string;
  } = {},
  onCreate?: (params: Record<string, unknown>) => void,
): LlmClient {
  return {
    async create(params) {
      onCreate?.(params);
      return {
        content: [
          {
            type: "tool_use",
            name: SCORE_TOOL_NAME,
            input: {
              scored: payload.scored ?? [],
              nextQuestion:
                payload.nextQuestion ??
                "Tell me about a time you carried something no one else would.",
            },
          },
        ],
      };
    },
  };
}

describe("createInterpreter — opening question", () => {
  it("asks Claude for an opening question and returns the tool-cited prompt", async () => {
    const captured: Record<string, unknown>[] = [];
    const client = fakeClient(
      { nextQuestion: "What situation made you feel most alive lately?" },
      (params) => captured.push(params),
    );
    const interp = createInterpreter({ client, model: "claude-opus-5" });

    const opening = await interp.openingQuestion();

    expect(opening).toBe("What situation made you feel most alive lately?");
    expect(captured).toHaveLength(1);
    expect(captured[0].model).toBe("claude-opus-5");
  });
});

describe("createInterpreter — scoring a Turn", () => {
  const priorTurns = [
    { question: "Q1", answer: "A1", scored: [] },
  ];

  it("returns the interpreter's Marker-cited deltas verbatim", async () => {
    const client = fakeClient({
      scored: [
        {
          markerId: judahStrength.id,
          tribeSlug: judahStrength.tribeSlug,
          type: judahStrength.type,
          delta: judahStrength.weight,
          postureSignal: 0,
        },
      ],
      nextQuestion: "Q2",
    });
    const interp = createInterpreter({ client, model: "claude-opus-5" });

    const result = await interp.scoreAnswer({
      question: "Q1",
      answer: "I stepped up to lead the difficult project.",
      priorTurns,
    });

    expect(result.scored).toEqual([
      {
        markerId: judahStrength.id,
        tribeSlug: judahStrength.tribeSlug,
        type: judahStrength.type,
        delta: judahStrength.weight,
        postureSignal: 0,
      },
    ]);
    expect(result.nextQuestion).toBe("Q2");
  });

  it("filters out deltas citing non-catalogued Markers (agent may only score by catalog — ADR 0003)", async () => {
    const client = fakeClient({
      scored: [
        {
          markerId: judahStrength.id,
          tribeSlug: "judah",
          type: "strength",
          delta: 1,
        },
        // Hallucinated Marker id — must be dropped.
        {
          markerId: "not-in-catalog",
          tribeSlug: "judah",
          type: "strength",
          delta: 1,
        },
      ],
      nextQuestion: "Q2",
    });
    const interp = createInterpreter({ client, model: "claude-opus-5" });

    const result = await interp.scoreAnswer({
      question: "Q1",
      answer: "I stepped up.",
      priorTurns,
    });

    expect(result.scored).toHaveLength(1);
    expect(result.scored[0].markerId).toBe(judahStrength.id);
  });

  it("throws InterpreterError when the tool call is missing", async () => {
    const client: LlmClient = {
      async create() {
        return { content: [{ type: "text", text: "no tool call" }] };
      },
    };
    const interp = createInterpreter({ client, model: "claude-opus-5" });
    await expect(
      interp.scoreAnswer({
        question: "Q1",
        answer: "an answer",
        priorTurns,
      }),
    ).rejects.toBeInstanceOf(InterpreterError);
  });

  it("forces the score_answer tool (structured output) — tool_choice targets it", async () => {
    const spy = vi.fn();
    const client = fakeClient(
      { nextQuestion: "Q2" },
      (params) => spy(params.tool_choice),
    );
    const interp = createInterpreter({ client, model: "claude-opus-5" });
    await interp.scoreAnswer({
      question: "Q1",
      answer: "an answer",
      priorTurns,
    });
    expect(spy).toHaveBeenCalledWith({ type: "tool", name: SCORE_TOOL_NAME });
  });
});

describe("createInterpreter — prompt caching (ADR 0009)", () => {
  it("marks the static context (system) with cache_control so it's cached across Turns", async () => {
    const captured: Record<string, unknown>[] = [];
    const client = fakeClient({ nextQuestion: "Q" }, (params) =>
      captured.push(params),
    );
    const interp = createInterpreter({ client, model: "claude-opus-5" });

    await interp.openingQuestion();
    const params = captured[0];

    // The system prompt should be a structured array with a cache_control breakpoint.
    expect(Array.isArray(params.system)).toBe(true);
    const system = params.system as Array<{ cache_control?: { type: string } }>;
    const cached = system.find((b) => b.cache_control?.type === "ephemeral");
    expect(cached).toBeTruthy();
  });

  it("keeps the same system blocks across Turns so the cache prefix is stable", async () => {
    const captured: unknown[] = [];
    const client = fakeClient({ nextQuestion: "Q" }, (params) =>
      captured.push(params.system),
    );
    const interp = createInterpreter({ client, model: "claude-opus-5" });

    await interp.openingQuestion();
    await interp.scoreAnswer({
      question: "Q1",
      answer: "answer",
      priorTurns: [],
    });

    expect(captured[0]).toEqual(captured[1]);
  });
});
