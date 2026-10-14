import { applyDeltas, emptyProfile } from "./scoring";
import type {
  InterviewState,
  InterviewTurn,
  NextTurn,
  ScoredDelta,
  StubResult,
} from "./types";

/**
 * Pure Interview flow logic: given a Session's state it decides what to show
 * next and folds a scored answer into the state. No LLM and no DB live here —
 * the model call (`agent.ts`) and persistence (`repository.ts`) sit on either
 * side of this seam, which keeps the state transitions testable in isolation.
 *
 * As of slice #16 answers are really scored: the agent returns catalogued
 * Marker deltas and `appendAnswer` applies them to the Strength Profile. This
 * is still a single open-ended Turn (the question is fixed); the multi-Turn
 * loop and Confidence/Stop evaluator arrive in slice #17, and the Funnel
 * planner that chooses questions in slice #19.
 */

// Re-exported so existing callers (`flow` was the profile's home in slice #14)
// keep their import path while the builder itself now lives with the engine.
export { emptyProfile };

/**
 * The opening question. A single open-ended Turn is enough for this slice; it
 * stays fixed because there is no prior answer to react to on the first Turn —
 * adaptive question selection is the Funnel planner's job (slice #19). Keeping
 * it an array lets later slices generalize the flow without changing its shape.
 */
export const QUESTIONS: readonly string[] = [
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?",
];

export const TOTAL_QUESTIONS = QUESTIONS.length;

const STUB_RESULT: StubResult = {
  headline: "Your interview is complete.",
  note: "Your answer has been scored against the tribe Markers and your profile saved. The full result view — your Primary tribe and its Contenders — arrives in an upcoming slice.",
};

/** The initial server-authoritative state for a newly created Session. */
export function initialState(): InterviewState {
  return { status: "in_progress", turns: [], profile: emptyProfile() };
}

/**
 * Decide what to show the participant next, derived purely from current state.
 * This is what makes the flow resumable: a reload re-derives the right view
 * from the persisted Session rather than trusting anything held on the client.
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || state.turns.length >= TOTAL_QUESTIONS) {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: QUESTIONS[state.turns.length],
    questionNumber: state.turns.length + 1,
    totalQuestions: TOTAL_QUESTIONS,
  };
}

/**
 * Fold a scored free-text answer into the state, returning a new state (no
 * mutation). The `deltas` are the catalog-validated Marker deltas the agent
 * scored for this answer (`agent.scoreAnswer`); they are recorded on the Turn
 * as its trace and applied additively to the running profile (ADR-0004). The
 * Turn is recorded against the question that was actually being asked, and the
 * Session is marked complete once the (single, in this slice) question is
 * answered.
 */
export function appendAnswer(
  state: InterviewState,
  answer: string,
  deltas: ScoredDelta[] = [],
): InterviewState {
  if (state.status === "complete" || state.turns.length >= TOTAL_QUESTIONS) {
    // Already done — answering again is a no-op rather than corrupting history.
    return state;
  }

  const turn: InterviewTurn = {
    question: QUESTIONS[state.turns.length],
    answer,
    deltas,
  };
  const turns = [...state.turns, turn];
  const status: InterviewState["status"] =
    turns.length >= TOTAL_QUESTIONS ? "complete" : "in_progress";

  return {
    ...state,
    turns,
    status,
    profile: applyDeltas(state.profile, deltas),
  };
}

/** The result for a completed Session. Throws if asked before completion. */
export function stubResult(state: InterviewState): StubResult {
  if (state.status !== "complete") {
    throw new Error("Result requested for an Interview that is not complete.");
  }
  return STUB_RESULT;
}
