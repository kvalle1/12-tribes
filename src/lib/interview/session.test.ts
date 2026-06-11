import { describe, it, expect } from "vitest";
import {
  startInterview,
  recordAnswer,
  currentTurn,
  PLACEHOLDER_QUESTIONS,
  type InterviewState,
} from "./session";

/**
 * The Interview Session is a pure, server-authoritative state machine: given the
 * current state and an answer, it returns the next state. Slice 1 has no LLM and
 * no scoring — the questions are a fixed placeholder script and the running
 * profile stays empty. These tests pin the externally-observable behaviour the
 * route handlers and persistence layer build on.
 */
describe("interview session state machine", () => {
  it("starts in progress on the first question with nothing answered", () => {
    const state = startInterview();

    expect(state.status).toBe("in_progress");
    expect(state.turnCount).toBe(0);
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toEqual({
      index: 0,
      question: PLACEHOLDER_QUESTIONS[0],
      answer: null,
    });

    const turn = currentTurn(state);
    expect(turn?.index).toBe(0);
    expect(turn?.question).toBe(PLACEHOLDER_QUESTIONS[0]);
  });

  it("keeps the running profile empty in slice 1 (no scoring yet)", () => {
    expect(startInterview().profile).toEqual({});
  });

  it("records an answer and advances to the next question", () => {
    const state = recordAnswer(startInterview(), "I look for the host.");

    expect(state.status).toBe("in_progress");
    expect(state.turnCount).toBe(1);
    // The first turn now carries its answer; a fresh unanswered turn is queued.
    expect(state.turns[0].answer).toBe("I look for the host.");
    expect(currentTurn(state)).toEqual({
      index: 1,
      question: PLACEHOLDER_QUESTIONS[1],
      answer: null,
    });
  });

  it("completes after the last placeholder question and exposes no current turn", () => {
    let state = startInterview();
    for (let i = 0; i < PLACEHOLDER_QUESTIONS.length; i++) {
      state = recordAnswer(state, `answer ${i}`);
    }

    expect(state.status).toBe("complete");
    expect(state.turnCount).toBe(PLACEHOLDER_QUESTIONS.length);
    expect(currentTurn(state)).toBeNull();
    // Every question is preserved in history with its answer (the score trace
    // future slices read from).
    expect(state.turns.map((t) => t.answer)).toEqual(
      PLACEHOLDER_QUESTIONS.map((_, i) => `answer ${i}`),
    );
  });

  it("refuses to record an answer once complete", () => {
    let state = startInterview();
    for (let i = 0; i < PLACEHOLDER_QUESTIONS.length; i++) {
      state = recordAnswer(state, "x");
    }

    expect(() => recordAnswer(state, "too late")).toThrow();
  });

  it("does not mutate the state it is given", () => {
    const state = startInterview();
    const before = JSON.stringify(state);
    recordAnswer(state, "first");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("resumes at the right point after a persistence round-trip", () => {
    // Simulate writing to Postgres and reading back mid-flow.
    const persisted = recordAnswer(startInterview(), "first answer");
    const reloaded: InterviewState = JSON.parse(JSON.stringify(persisted));

    const turn = currentTurn(reloaded);
    expect(turn?.index).toBe(1);
    expect(turn?.question).toBe(PLACEHOLDER_QUESTIONS[1]);

    // Continuing from the reloaded state behaves identically to never reloading.
    const continued = recordAnswer(reloaded, "second answer");
    expect(continued.turnCount).toBe(2);
  });
});
