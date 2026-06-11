import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  appendAnswer,
  emptyProfile,
  initialState,
  nextTurn,
  QUESTIONS,
  stubResult,
  TOTAL_QUESTIONS,
} from "./flow";

describe("emptyProfile", () => {
  it("covers all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) {
      expect(profile[tribe.slug]).toBe(0);
    }
  });
});

describe("initialState / nextTurn", () => {
  it("starts in progress with no turns", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
  });

  it("presents the first hardcoded question when no turns have been taken", () => {
    const turn = nextTurn(initialState());
    expect(turn).toEqual({
      kind: "question",
      prompt: QUESTIONS[0],
      questionNumber: 1,
      totalQuestions: TOTAL_QUESTIONS,
    });
  });
});

describe("appendAnswer", () => {
  it("records the answer against the question that was being asked", () => {
    const state = appendAnswer(initialState(), "I was teaching a friend to climb.");
    expect(state.turns).toEqual([
      { question: QUESTIONS[0], answer: "I was teaching a friend to climb." },
    ]);
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    appendAnswer(before, "an answer");
    expect(before.turns).toEqual([]);
    expect(before.status).toBe("in_progress");
  });

  it("completes the session once the final question is answered", () => {
    const state = appendAnswer(initialState(), "an answer");
    expect(state.status).toBe("complete");
    expect(nextTurn(state)).toEqual({ kind: "result" });
  });

  it("is a no-op once the session is already complete", () => {
    const complete = appendAnswer(initialState(), "first");
    const again = appendAnswer(complete, "second");
    expect(again).toBe(complete);
    expect(again.turns).toHaveLength(TOTAL_QUESTIONS);
  });
});

describe("stubResult", () => {
  it("returns a placeholder result for a completed session", () => {
    const complete = appendAnswer(initialState(), "an answer");
    const result = stubResult(complete);
    expect(result.headline).toBeTruthy();
    expect(result.note).toBeTruthy();
  });

  it("refuses to produce a result before completion", () => {
    expect(() => stubResult(initialState())).toThrow();
  });
});
