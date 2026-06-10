import { describe, expect, it } from "vitest";
import {
  INTERVIEW_QUESTIONS,
  currentQuestion,
  initialState,
  isComplete,
  recordAnswer,
} from "./session";

describe("interview session state machine", () => {
  it("starts in progress with no turns", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.turnCount).toBe(0);
    expect(isComplete(state)).toBe(false);
  });

  it("offers the first scripted question to a fresh session", () => {
    expect(currentQuestion(initialState())).toBe(INTERVIEW_QUESTIONS[0]);
  });

  it("records an answer as a turn carrying the question it answered", () => {
    const next = recordAnswer(initialState(), "I felt most myself leading a team.");

    expect(next.turnCount).toBe(1);
    expect(next.turns).toHaveLength(1);
    expect(next.turns[0]).toEqual({
      index: 0,
      question: INTERVIEW_QUESTIONS[0],
      answer: "I felt most myself leading a team.",
    });
  });

  it("does not mutate the input state", () => {
    const state = initialState();
    recordAnswer(state, "an answer");
    expect(state.turns).toEqual([]);
    expect(state.turnCount).toBe(0);
  });

  it("completes once every scripted question has been answered", () => {
    let state = initialState();
    for (let i = 0; i < INTERVIEW_QUESTIONS.length; i++) {
      expect(state.status).toBe("in_progress");
      state = recordAnswer(state, `answer ${i}`);
    }

    expect(state.status).toBe("complete");
    expect(isComplete(state)).toBe(true);
    expect(currentQuestion(state)).toBeNull();
  });

  it("is a no-op when answering an already-complete session", () => {
    let state = initialState();
    for (let i = 0; i < INTERVIEW_QUESTIONS.length; i++) {
      state = recordAnswer(state, `answer ${i}`);
    }
    const complete = state;

    const again = recordAnswer(complete, "extra answer after the end");
    expect(again).toEqual(complete);
  });
});
