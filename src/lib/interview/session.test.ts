import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  FIRST_QUESTION,
  TOTAL_QUESTIONS,
  createInitialState,
  currentQuestion,
  emptyProfile,
  isComplete,
  recordAnswer,
} from "./session";

describe("emptyProfile", () => {
  it("is a zeroed score for every one of the 12 tribes", () => {
    const profile = emptyProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) {
      expect(profile[tribe.slug]).toBe(0);
    }
  });
});

describe("createInitialState", () => {
  it("starts in progress with no turns, a zero count, and a placeholder profile", () => {
    const state = createInitialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.turnCount).toBe(0);
    expect(state.profile).toEqual(emptyProfile());
    expect(isComplete(state)).toBe(false);
  });
});

describe("currentQuestion", () => {
  it("is the hardcoded first question for a fresh interview", () => {
    expect(currentQuestion(createInitialState())).toBe(FIRST_QUESTION);
  });

  it("is null once the interview is complete", () => {
    let state = createInitialState();
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      state = recordAnswer(state, `answer ${i}`);
    }
    expect(currentQuestion(state)).toBeNull();
  });
});

describe("recordAnswer", () => {
  it("appends the question and answer to the turn history and increments the count", () => {
    const state = recordAnswer(createInitialState(), "  I lead from the front.  ");
    expect(state.turnCount).toBe(1);
    expect(state.turns).toEqual([
      { question: FIRST_QUESTION, answer: "I lead from the front." },
    ]);
  });

  it("does not mutate the input state", () => {
    const initial = createInitialState();
    recordAnswer(initial, "an answer");
    expect(initial.turns).toEqual([]);
    expect(initial.turnCount).toBe(0);
    expect(initial.status).toBe("in_progress");
  });

  it("completes the interview after the final question is answered", () => {
    let state = createInitialState();
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      expect(isComplete(state)).toBe(false);
      state = recordAnswer(state, `answer ${i}`);
    }
    expect(isComplete(state)).toBe(true);
    expect(state.status).toBe("complete");
    expect(state.turns).toHaveLength(TOTAL_QUESTIONS);
  });

  it("rejects a blank answer", () => {
    expect(() => recordAnswer(createInitialState(), "   ")).toThrow();
  });

  it("rejects an answer once the interview is already complete", () => {
    let state = createInitialState();
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      state = recordAnswer(state, `answer ${i}`);
    }
    expect(() => recordAnswer(state, "one more")).toThrow();
  });
});
