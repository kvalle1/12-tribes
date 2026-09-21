import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  appendTurn,
  emptyProfile,
  finalizeScoredTurn,
  initialState,
  lastTurnIndex,
  MAX_TURNS,
  nextTurn,
  OPENING_QUESTION,
} from "./flow";
import type { InterviewState, ScoredTurnUpdate, TraceEntry } from "./types";

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
  it("starts in progress with no turns and the opening question pending", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.trace).toEqual([]);
    expect(state.currentQuestion).toBe(OPENING_QUESTION);
  });

  it("presents the opening question first", () => {
    expect(nextTurn(initialState())).toEqual({
      kind: "question",
      prompt: OPENING_QUESTION,
      questionNumber: 1,
      totalQuestions: MAX_TURNS,
    });
  });

  it("presents the agent-produced question after the first Turn", () => {
    const state: InterviewState = {
      status: "in_progress",
      turns: [{ question: OPENING_QUESTION, answer: "a" }],
      profile: emptyProfile(),
      trace: [],
      currentQuestion: "What draws you to lead?",
    };
    expect(nextTurn(state)).toEqual({
      kind: "question",
      prompt: "What draws you to lead?",
      questionNumber: 2,
      totalQuestions: MAX_TURNS,
    });
  });

  it("resolves to the result once complete", () => {
    const state: InterviewState = {
      status: "complete",
      turns: [],
      profile: emptyProfile(),
      trace: [],
      currentQuestion: null,
    };
    expect(nextTurn(state)).toEqual({ kind: "result" });
  });
});

describe("appendTurn", () => {
  it("records the answer against the question currently being asked", () => {
    const state = appendTurn(initialState(), "I was teaching a friend to climb.");
    expect(state.turns).toEqual([
      { question: OPENING_QUESTION, answer: "I was teaching a friend to climb." },
    ]);
    expect(lastTurnIndex(state)).toBe(0);
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    appendTurn(before, "an answer");
    expect(before.turns).toEqual([]);
  });

  it("is a no-op when the session is complete or has no pending question", () => {
    const complete: InterviewState = {
      status: "complete",
      turns: [],
      profile: emptyProfile(),
      trace: [],
      currentQuestion: null,
    };
    expect(appendTurn(complete, "x")).toBe(complete);
  });
});

describe("finalizeScoredTurn", () => {
  const update = (profileSlug: string): ScoredTurnUpdate => {
    const profile = emptyProfile();
    profile[profileSlug] = 3;
    const newTrace: TraceEntry[] = [
      {
        turnIndex: 0,
        markerId: `${profileSlug}-strength-x`,
        tribeSlug: profileSlug,
        type: "strength",
        contribution: 3,
      },
    ];
    return { profile, newTrace, nextQuestion: "And then what happened?" };
  };

  it("folds the applied profile and appends the new trace", () => {
    const appended = appendTurn(initialState(), "a");
    const next = finalizeScoredTurn(appended, update("judah"));
    expect(next.profile.judah).toBe(3);
    expect(next.trace).toHaveLength(1);
    expect(next.trace[0].markerId).toBe("judah-strength-x");
  });

  it("continues the Session and sets the agent's next question before the cap", () => {
    const appended = appendTurn(initialState(), "a"); // 1 turn, < MAX_TURNS
    const next = finalizeScoredTurn(appended, update("levi"));
    expect(next.status).toBe("in_progress");
    expect(next.currentQuestion).toBe("And then what happened?");
  });

  it("completes the Session and clears the question at the Turn cap", () => {
    // Build a state that already has MAX_TURNS answers recorded.
    let state = initialState();
    for (let i = 0; i < MAX_TURNS; i++) {
      state = appendTurn(state, `answer ${i}`);
      // keep a pending question between turns so appendTurn isn't a no-op
      if (i < MAX_TURNS - 1) state = { ...state, currentQuestion: "next?" };
    }
    expect(state.turns).toHaveLength(MAX_TURNS);
    const next = finalizeScoredTurn(state, update("dan"));
    expect(next.status).toBe("complete");
    expect(next.currentQuestion).toBeNull();
  });

  it("does not mutate the input trace array", () => {
    const appended = appendTurn(initialState(), "a");
    const before = appended.trace;
    finalizeScoredTurn(appended, update("gad"));
    expect(appended.trace).toBe(before);
    expect(appended.trace).toHaveLength(0);
  });
});
