import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  appendAnswer,
  emptyPosture,
  emptyProfile,
  initialState,
  nextTurn,
  stubResult,
  TOTAL_QUESTIONS,
} from "./flow";

const OPENING = "Tell me about a recent time you felt most like yourself.";

describe("emptyProfile / emptyPosture", () => {
  it("cover all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyProfile();
    const posture = emptyPosture();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    expect(Object.keys(posture)).toHaveLength(tribes.length);
    for (const tribe of tribes) {
      expect(profile[tribe.slug]).toBe(0);
      expect(posture[tribe.slug]).toBe(0);
    }
  });
});

describe("initialState / nextTurn", () => {
  it("starts in progress with no turns and an empty trace", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.trace).toEqual([]);
  });

  it("presents the Session's pending (LLM-produced) question when no turns have been taken", () => {
    const turn = nextTurn(initialState(), OPENING);
    expect(turn).toEqual({
      kind: "question",
      prompt: OPENING,
      questionNumber: 1,
      totalQuestions: TOTAL_QUESTIONS,
    });
  });
});

describe("appendAnswer", () => {
  it("records the answer against the question that was actually asked", () => {
    const state = appendAnswer(initialState(), OPENING, "I was teaching a friend to climb.");
    expect(state.turns).toEqual([
      { question: OPENING, answer: "I was teaching a friend to climb." },
    ]);
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    appendAnswer(before, OPENING, "an answer");
    expect(before.turns).toEqual([]);
    expect(before.status).toBe("in_progress");
  });

  it("completes the session once the final question is answered", () => {
    const state = appendAnswer(initialState(), OPENING, "an answer");
    expect(state.status).toBe("complete");
    expect(nextTurn(state, null)).toEqual({ kind: "result" });
  });

  it("is a no-op once the session is already complete", () => {
    const complete = appendAnswer(initialState(), OPENING, "first");
    const again = appendAnswer(complete, OPENING, "second");
    expect(again).toBe(complete);
    expect(again.turns).toHaveLength(TOTAL_QUESTIONS);
  });
});

describe("stubResult", () => {
  it("returns a placeholder result for a completed session", () => {
    const complete = appendAnswer(initialState(), OPENING, "an answer");
    const result = stubResult(complete);
    expect(result.headline).toBeTruthy();
    expect(result.note).toBeTruthy();
  });

  it("refuses to produce a result before completion", () => {
    expect(() => stubResult(initialState())).toThrow();
  });
});
