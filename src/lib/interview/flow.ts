import "server-only";

import {
  applyDeltas,
  deriveRanking,
  emptyStrengthProfile,
} from "./scoring";
import type {
  InterviewResult,
  InterviewState,
  InterviewTurn,
  NextTurn,
  ScoredDelta,
} from "./types";

/**
 * Pure Interview flow logic (issue #16 — real scoring).
 *
 * The walking skeleton's hardcoded single question is replaced by an
 * agent-driven loop: a fixed opening question, then each answer is scored
 * against the Marker Catalog and the agent proposes the next question. This
 * module owns the *state transitions* — apply a scored Turn, decide what to
 * show next, derive the result — and stays pure and testable (the Anthropic
 * call lives in `agent.ts`; persistence in `repository.ts`).
 *
 * The Confidence/Stop evaluator (slice #17) will replace the fixed Turn cap
 * below with a real Stop Condition; the Funnel planner (slice #5) replaces the
 * fixed opener with Calibration questions.
 */

/**
 * A neutral, broad opening question (the anti-anchoring floor). Question 1 is
 * fixed; every later question is produced by the agent. Kept as a constant so
 * later slices can swap it for the Funnel's Calibration opener.
 */
export const OPENING_QUESTION =
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?";

/**
 * How many Turns the Interview runs before reporting a result. A fixed cap
 * stands in for the Confidence/Stop evaluator (slice #17); a small value keeps
 * this slice's scope to "the loop scores each answer and accumulates". More than
 * one Turn is deliberate — it exercises the agent-produced next question.
 */
export const INTERVIEW_TURN_CAP = 3;

export { emptyStrengthProfile };

/** Back-compat alias for the walking-skeleton name used by callers/tests. */
export const emptyProfile = emptyStrengthProfile;

/** The initial server-authoritative state for a newly created Session. */
export function initialState(): InterviewState {
  return {
    status: "in_progress",
    turns: [],
    profile: emptyStrengthProfile(),
    trace: [],
    currentQuestion: OPENING_QUESTION,
  };
}

/**
 * Decide what to show next, derived purely from current state — a reload
 * re-derives the right view from the persisted Session rather than trusting the
 * client (ADR-0011). A complete Session, or one with no pending question, shows
 * the result.
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || !state.currentQuestion) {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: state.currentQuestion,
    questionNumber: state.turns.length + 1,
    totalQuestions: INTERVIEW_TURN_CAP,
  };
}

/** Inputs for folding one scored answer into the Session. */
export interface ScoredTurnInput {
  /** The free-text answer to the question currently being shown. */
  answer: string;
  /** The cited Marker deltas the agent scored from the answer. */
  deltas: ScoredDelta[];
  /** The next question the agent proposes (used only if the Session continues). */
  nextQuestion: string;
}

/**
 * Fold a scored answer into the state, returning a new state (no mutation).
 * Applies the cited deltas to the Strength Profile via the scoring engine,
 * records the Turn and its score trace, and either advances to the agent's next
 * question or completes the Session once the Turn cap is reached. Answering a
 * complete Session is a no-op, so a double submit can't corrupt history.
 */
export function recordScoredTurn(
  state: InterviewState,
  input: ScoredTurnInput,
): InterviewState {
  if (state.status === "complete" || !state.currentQuestion) {
    return state;
  }

  const turnIndex = state.turns.length;
  const { profile, trace } = applyDeltas(state.profile, input.deltas, turnIndex);

  const turn: InterviewTurn = {
    question: state.currentQuestion,
    answer: input.answer,
    deltas: input.deltas,
  };
  const turns = [...state.turns, turn];
  const complete = turns.length >= INTERVIEW_TURN_CAP;

  return {
    status: complete ? "complete" : "in_progress",
    turns,
    profile,
    trace: [...state.trace, ...trace],
    currentQuestion: complete ? null : input.nextQuestion,
  };
}

/**
 * Derive the result — the full 12-tribe Strength Profile ranked by score — from
 * a completed Session. Throws if the Session is not complete.
 */
export function deriveInterviewResult(state: InterviewState): InterviewResult {
  if (state.status !== "complete") {
    throw new Error("Result requested for an Interview that is not complete.");
  }
  return { ranking: deriveRanking(state.profile) };
}
