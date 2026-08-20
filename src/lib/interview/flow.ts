import { emptyPosture, emptyStrengthProfile } from "./scoring";
import type { InterviewState, NextTurn, StubResult } from "./types";

/**
 * Pure Interview flow logic — the projection layer between the persisted
 * Session and what the UI renders.
 *
 * The walking-skeleton slice hardcoded a question list here. In slice 3 the
 * question comes from the interpreter (ADR 0005 / 0009) and is persisted on the
 * Session as `currentQuestion`, so this file no longer knows about specific
 * prompts — it decides only *what kind* of view to show next given the state.
 * Real scoring (Marker deltas, Posture) is applied by `scoring.ts`; the LLM
 * boundary is `interpreter.ts`.
 *
 * `TOTAL_QUESTIONS` is deliberately still 1 in this slice: the single-Turn
 * horizon is enough to prove real LLM scoring end-to-end (the issue body says
 * so explicitly). The multi-Turn loop with Confidence / Stop arrives in
 * slice #17, which reuses the same shape.
 */

export const TOTAL_QUESTIONS = 1;

const STUB_RESULT: StubResult = {
  headline: "Your interview is complete.",
  note:
    "This slice runs a single, real-scored Turn. Multi-Turn conversation, " +
    "the Confidence / Stop evaluator, and the Primary + Contender result view " +
    "arrive in the next slices — the deltas you see below are already the " +
    "real thing.",
};

/**
 * Fresh state for a newly created Session. `currentQuestion` starts null and is
 * populated by the caller (`repository.createInterviewSession`) after asking the
 * interpreter for an opening — keeping this pure module free of the LLM
 * dependency so it stays trivially unit-testable.
 */
export function initialState(): InterviewState {
  return {
    status: "in_progress",
    turns: [],
    profile: emptyStrengthProfile(),
    posture: emptyPosture(),
    currentQuestion: null,
  };
}

/**
 * Decide what the participant should be shown next, derived purely from the
 * persisted Session. A reload re-derives from state rather than trusting the
 * client — the basis for the resume behavior (ADR 0011).
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || state.turns.length >= TOTAL_QUESTIONS) {
    return { kind: "result" };
  }
  if (!state.currentQuestion) {
    // The Session was created but the interpreter hasn't produced the opening
    // yet. Callers should schedule that; render the same "next turn" shape
    // with the opening text once it lands.
    return {
      kind: "question",
      prompt: "",
      questionNumber: state.turns.length + 1,
      totalQuestions: TOTAL_QUESTIONS,
    };
  }
  return {
    kind: "question",
    prompt: state.currentQuestion,
    questionNumber: state.turns.length + 1,
    totalQuestions: TOTAL_QUESTIONS,
  };
}

/**
 * Given a state that has just had a scored Turn folded in (via
 * `scoring.applyScoredTurn`), settle it: if the question floor is reached,
 * mark the Session complete; otherwise, install the interpreter's chosen next
 * question. Kept pure so the DB layer only decides *when* to persist.
 */
export function settleTurn(
  state: InterviewState,
  nextQuestion: string | null,
): InterviewState {
  if (state.turns.length >= TOTAL_QUESTIONS) {
    return { ...state, status: "complete", currentQuestion: null };
  }
  return { ...state, currentQuestion: nextQuestion };
}

/** The (stub, slice-3) result for a completed Session. Throws before completion. */
export function stubResult(state: InterviewState): StubResult {
  if (state.status !== "complete") {
    throw new Error("Result requested for an Interview that is not complete.");
  }
  return STUB_RESULT;
}
