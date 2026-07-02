import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  appendScoredAnswer,
  currentQuestion,
  emptyProfile,
  initialState,
  INTERVIEW_TURN_COUNT,
  nextTurn,
  OPENING_QUESTION,
} from "./flow";
import type { AppliedDelta } from "./types";

const scored = (
  question: string,
  profile = emptyProfile(),
  deltas: AppliedDelta[] = [],
  nextQuestion = "And what happened next?",
) => ({ question, answer: "an answer", deltas, profile, nextQuestion });

describe("emptyProfile", () => {
  it("covers all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) expect(profile[tribe.slug]).toBe(0);
  });
});

describe("initialState / nextTurn", () => {
  it("starts in progress with no turns and no next question", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.nextQuestion).toBeNull();
  });

  it("presents the fixed opener when no turns have been taken", () => {
    const turn = nextTurn(initialState());
    expect(turn).toEqual({
      kind: "question",
      prompt: OPENING_QUESTION,
      questionNumber: 1,
      totalQuestions: INTERVIEW_TURN_COUNT,
    });
  });
});

describe("currentQuestion", () => {
  it("is the opener before any answer, then the agent-produced question", () => {
    const state = initialState();
    expect(currentQuestion(state)).toBe(OPENING_QUESTION);

    const after = appendScoredAnswer(
      state,
      scored(OPENING_QUESTION, emptyProfile(), [], "What drew you to that?"),
    );
    expect(currentQuestion(after)).toBe("What drew you to that?");
  });
});

describe("appendScoredAnswer", () => {
  it("records the answer, its trace, and the scored profile", () => {
    const trace: AppliedDelta[] = [
      {
        markerId: "judah-strength-front",
        tribeSlug: "judah",
        type: "strength",
        weight: 1,
        delta: 0.8,
        contribution: 0.8,
        postureSignal: 0.5,
      },
    ];
    const profile = { ...emptyProfile(), judah: 0.8 };
    const state = appendScoredAnswer(
      initialState(),
      scored(OPENING_QUESTION, profile, trace, "Why did that matter to you?"),
    );

    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].deltas).toEqual(trace);
    expect(state.profile.judah).toBe(0.8);
    expect(state.nextQuestion).toBe("Why did that matter to you?");
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    appendScoredAnswer(before, scored(OPENING_QUESTION));
    expect(before.turns).toEqual([]);
    expect(before.status).toBe("in_progress");
  });

  it("completes the session once the final Turn is answered", () => {
    let state = initialState();
    for (let i = 0; i < INTERVIEW_TURN_COUNT; i++) {
      expect(state.status).toBe("in_progress");
      state = appendScoredAnswer(state, scored(currentQuestion(state)));
    }
    expect(state.status).toBe("complete");
    expect(nextTurn(state)).toEqual({ kind: "result" });
  });

  it("is a no-op once the session is already complete", () => {
    let state = initialState();
    for (let i = 0; i < INTERVIEW_TURN_COUNT; i++) {
      state = appendScoredAnswer(state, scored(currentQuestion(state)));
    }
    const again = appendScoredAnswer(state, scored("extra"));
    expect(again).toBe(state);
    expect(again.turns).toHaveLength(INTERVIEW_TURN_COUNT);
  });
});
