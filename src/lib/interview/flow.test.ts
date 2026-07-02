import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  MAX_TURNS,
  OPENING_QUESTION,
  emptyProfile,
  initialState,
  interviewResult,
  nextTurn,
  recordScoredTurn,
} from "./flow";
import type { MarkerDelta } from "./types";

const JUDAH_STRENGTH: MarkerDelta = {
  markerId: "judah-strength-front",
  tribeSlug: "judah",
  type: "strength",
  delta: 1,
  postureSignal: "neutral",
};

/** Answer one Turn with a fixed Judah score and a canned next question. */
function answer(state: ReturnType<typeof initialState>, text: string) {
  return recordScoredTurn(state, {
    answer: text,
    deltas: [JUDAH_STRENGTH],
    nextQuestion: "And what did that cost you?",
  });
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
  it("starts in progress with the calibration opener seeded", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.trace).toEqual([]);
    expect(state.pendingQuestion).toBe(OPENING_QUESTION);
  });

  it("presents the opener first", () => {
    expect(nextTurn(initialState())).toEqual({
      kind: "question",
      prompt: OPENING_QUESTION,
      questionNumber: 1,
      totalQuestions: MAX_TURNS,
    });
  });
});

describe("recordScoredTurn", () => {
  it("records the answer against the question that was being asked", () => {
    const state = answer(initialState(), "I stepped up to lead.");
    expect(state.turns[0]).toEqual({
      question: OPENING_QUESTION,
      answer: "I stepped up to lead.",
    });
  });

  it("applies the scored deltas to the profile and appends a trace entry", () => {
    const state = answer(initialState(), "I stepped up to lead.");
    expect(state.profile.judah).toBeCloseTo(1);
    expect(state.trace).toHaveLength(1);
    expect(state.trace[0].applied[0].markerId).toBe("judah-strength-front");
  });

  it("advances to the agent's next question while in progress", () => {
    const state = answer(initialState(), "an answer");
    expect(state.status).toBe("in_progress");
    expect(state.pendingQuestion).toBe("And what did that cost you?");
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    answer(before, "an answer");
    expect(before.turns).toEqual([]);
    expect(before.trace).toEqual([]);
  });

  it("completes once the Turn cap is reached", () => {
    let state = initialState();
    for (let i = 0; i < MAX_TURNS; i++) {
      state = answer(state, `answer ${i}`);
    }
    expect(state.status).toBe("complete");
    expect(state.turns).toHaveLength(MAX_TURNS);
    expect(nextTurn(state)).toEqual({ kind: "result" });
  });

  it("is a no-op once the session is already complete", () => {
    let state = initialState();
    for (let i = 0; i < MAX_TURNS; i++) {
      state = answer(state, `answer ${i}`);
    }
    const again = answer(state, "extra");
    expect(again).toBe(state);
  });

  it("falls back to the current question when the agent supplies none", () => {
    const state = recordScoredTurn(initialState(), {
      answer: "an answer",
      deltas: [],
      nextQuestion: "",
    });
    expect(state.pendingQuestion).toBe(OPENING_QUESTION);
  });
});

describe("interviewResult", () => {
  it("names the leading tribe for a completed session", () => {
    let state = initialState();
    for (let i = 0; i < MAX_TURNS; i++) {
      state = answer(state, `answer ${i}`);
    }
    const result = interviewResult(state);
    expect(result.headline).toContain("Judah");
    expect(result.note).toBeTruthy();
  });

  it("refuses to produce a result before completion", () => {
    expect(() => interviewResult(initialState())).toThrow();
  });
});
