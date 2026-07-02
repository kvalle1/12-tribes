import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  emptyProfile,
  initialState,
  MAX_QUESTIONS,
  nextTurn,
  OPENING_QUESTION,
  recordScoredTurn,
  stubResult,
} from "./flow";
import type { AppliedDelta } from "./score";

const TRACE: AppliedDelta[] = [
  {
    markerId: "judah-strength-front",
    tribeSlug: "judah",
    type: "strength",
    delta: 1,
    weight: 1,
    contribution: 1,
    postureSignal: "neutral",
  },
];

/** Score N turns in a row, threading the state, to reach a given point in the flow. */
function scoreTurns(count: number) {
  let state = initialState();
  for (let i = 0; i < count; i++) {
    state = recordScoredTurn(state, {
      answer: `answer ${i + 1}`,
      trace: TRACE,
      profile: { ...state.profile, judah: (state.profile.judah ?? 0) + 1 },
      nextQuestion: `question ${i + 2}`,
    });
  }
  return state;
}

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
  it("starts in progress at the opening question with no turns", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.currentQuestion).toBe(OPENING_QUESTION);
  });

  it("presents the opening question when no turns have been taken", () => {
    const turn = nextTurn(initialState());
    expect(turn).toEqual({
      kind: "question",
      prompt: OPENING_QUESTION,
      questionNumber: 1,
      totalQuestions: MAX_QUESTIONS,
    });
  });

  it("presents the agent-produced next question on later turns", () => {
    const state = scoreTurns(1);
    expect(nextTurn(state)).toEqual({
      kind: "question",
      prompt: "question 2",
      questionNumber: 2,
      totalQuestions: MAX_QUESTIONS,
    });
  });
});

describe("recordScoredTurn", () => {
  it("records the answer and trace against the question that was being asked", () => {
    const state = recordScoredTurn(initialState(), {
      answer: "I was teaching a friend to climb.",
      trace: TRACE,
      profile: { ...emptyProfile(), judah: 1 },
      nextQuestion: "What happened next?",
    });
    expect(state.turns).toEqual([
      {
        question: OPENING_QUESTION,
        answer: "I was teaching a friend to climb.",
        trace: TRACE,
      },
    ]);
    expect(state.currentQuestion).toBe("What happened next?");
    expect(state.profile.judah).toBe(1);
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    recordScoredTurn(before, {
      answer: "an answer",
      trace: [],
      profile: emptyProfile(),
      nextQuestion: "next?",
    });
    expect(before.turns).toEqual([]);
    expect(before.status).toBe("in_progress");
    expect(before.currentQuestion).toBe(OPENING_QUESTION);
  });

  it("completes the session once the turn cap is reached", () => {
    const state = scoreTurns(MAX_QUESTIONS);
    expect(state.status).toBe("complete");
    expect(state.turns).toHaveLength(MAX_QUESTIONS);
    expect(nextTurn(state)).toEqual({ kind: "result" });
  });

  it("is a no-op once the session is already complete", () => {
    const complete = scoreTurns(MAX_QUESTIONS);
    const again = recordScoredTurn(complete, {
      answer: "extra",
      trace: TRACE,
      profile: emptyProfile(),
      nextQuestion: "extra?",
    });
    expect(again).toBe(complete);
    expect(again.turns).toHaveLength(MAX_QUESTIONS);
  });
});

describe("stubResult", () => {
  it("returns a placeholder result for a completed session", () => {
    const complete = scoreTurns(MAX_QUESTIONS);
    const result = stubResult(complete);
    expect(result.headline).toBeTruthy();
    expect(result.note).toBeTruthy();
  });

  it("refuses to produce a result before completion", () => {
    expect(() => stubResult(initialState())).toThrow();
  });
});
