import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  TOTAL_QUESTIONS,
  initialState,
  nextTurn,
  settleTurn,
  stubResult,
} from "./flow";

describe("initialState", () => {
  it("starts in progress with no turns, no question yet, and every tribe zeroed", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.currentQuestion).toBeNull();
    for (const tribe of tribes) {
      expect(state.profile[tribe.slug]).toBe(0);
      expect(state.posture[tribe.slug]).toBe(0);
    }
  });
});

describe("nextTurn (projection of persisted state)", () => {
  it("returns the current question when the Session is in progress", () => {
    const state = { ...initialState(), currentQuestion: "Q1" };
    expect(nextTurn(state)).toEqual({
      kind: "question",
      prompt: "Q1",
      questionNumber: 1,
      totalQuestions: TOTAL_QUESTIONS,
    });
  });

  it("returns an empty prompt while an opening question hasn't landed yet", () => {
    // The Session was created but the interpreter hasn't populated the opening
    // yet — nextTurn still reports the "question" kind so the caller can wait.
    const state = initialState();
    const turn = nextTurn(state);
    expect(turn.kind).toBe("question");
  });

  it("routes to the result view once the Session is complete", () => {
    const state = { ...initialState(), status: "complete" as const };
    expect(nextTurn(state)).toEqual({ kind: "result" });
  });
});

describe("settleTurn", () => {
  it("marks the Session complete once the question floor is reached", () => {
    const state = {
      ...initialState(),
      turns: Array.from({ length: TOTAL_QUESTIONS }, () => ({
        question: "Q",
        answer: "A",
        scored: [],
      })),
    };
    const next = settleTurn(state, "unused-next");
    expect(next.status).toBe("complete");
    expect(next.currentQuestion).toBeNull();
  });

  it("otherwise installs the interpreter's next question", () => {
    const state = initialState();
    const next = settleTurn(state, "Q2");
    expect(next.status).toBe("in_progress");
    expect(next.currentQuestion).toBe("Q2");
  });
});

describe("stubResult", () => {
  it("refuses to produce a result before completion", () => {
    expect(() => stubResult(initialState())).toThrow();
  });

  it("returns a placeholder result for a completed session", () => {
    const complete = { ...initialState(), status: "complete" as const };
    const result = stubResult(complete);
    expect(result.headline).toBeTruthy();
    expect(result.note).toBeTruthy();
  });
});
