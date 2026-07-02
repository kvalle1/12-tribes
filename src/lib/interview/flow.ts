import { emptyProfile, rankedProfile, scoreTurn } from "./score";
import type {
  InterviewResult,
  InterviewState,
  InterviewTurn,
  MarkerDelta,
  NextTurn,
} from "./types";

// Re-exported so persistence can seed a fresh profile without reaching past the
// flow into the scoring engine.
export { emptyProfile };

/**
 * Pure Interview flow logic (issue #16).
 *
 * Slice 1 hardcoded a single question and a stub result. Now the questions are
 * LLM-produced and answers are scored against the Marker Catalog: the flow holds
 * the current `pendingQuestion` (the opener, then whatever the agent asks next),
 * folds each scored answer into the profile and trace, and reports a result from
 * the ranked profile.
 *
 * The *scoring* stays in the pure `score` engine and the *LLM call* in the
 * `agent` client; this module only sequences Turns, so it remains testable
 * without either. The Confidence/Stop evaluator that decides when to stop is
 * slice 4 (#17) — until then a fixed cap bounds the Interview.
 */

/**
 * The fixed calibration opener — broad and neutral, touching everyone's
 * territory at low resolution so nothing is anchored before the agent narrows.
 * There is no answer to score yet, so it is seeded rather than agent-produced.
 */
export const OPENING_QUESTION =
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?";

/**
 * Placeholder Turn cap for this slice. The real Stop Condition (min floor,
 * evidence-relative margin, ranking stability, hard cap) is the Confidence/Stop
 * evaluator in slice 4 (#17); this constant just bounds the walking loop until
 * then.
 */
export const MAX_TURNS = 3;

/** The initial server-authoritative state for a newly created Session. */
export function initialState(): InterviewState {
  return {
    status: "in_progress",
    turns: [],
    profile: emptyProfile(),
    trace: [],
    pendingQuestion: OPENING_QUESTION,
  };
}

/**
 * Decide what to show next, derived purely from current state — a reload
 * re-derives the right view from the persisted Session rather than trusting the
 * client (ADR-0011).
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete") {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: state.pendingQuestion,
    questionNumber: state.turns.length + 1,
    totalQuestions: MAX_TURNS,
  };
}

/**
 * Fold a scored answer into the state (no mutation): apply the cited Marker
 * deltas to the profile, append the Turn and its score trace, and advance to the
 * agent's next question. Completes once the Turn cap is reached; answering a
 * complete Session is a no-op rather than corrupting history.
 */
export function recordScoredTurn(
  state: InterviewState,
  scored: { answer: string; deltas: MarkerDelta[]; nextQuestion: string },
): InterviewState {
  if (state.status === "complete") {
    return state;
  }

  const question = state.pendingQuestion;
  const { profile, trace } = scoreTurn(
    { profile: state.profile, trace: state.trace },
    { question, answer: scored.answer, deltas: scored.deltas },
  );

  const turn: InterviewTurn = { question, answer: scored.answer };
  const turns = [...state.turns, turn];
  const complete = turns.length >= MAX_TURNS;

  // Fall back to the current question if the agent didn't supply a usable one,
  // so a resume never lands on an empty prompt.
  const nextQuestion =
    complete || !scored.nextQuestion ? question : scored.nextQuestion;

  return {
    status: complete ? "complete" : "in_progress",
    turns,
    profile,
    trace,
    pendingQuestion: nextQuestion,
  };
}

/**
 * The result for a completed Session — the leading tribe by normalized strength.
 * This is a provisional headline for this slice; the full Primary + Contenders
 * result (with the Stop Condition behind it) is slice 4 (#17). Throws if asked
 * before completion.
 */
export function interviewResult(state: InterviewState): InterviewResult {
  if (state.status !== "complete") {
    throw new Error("Result requested for an Interview that is not complete.");
  }

  const [leader] = rankedProfile(state.profile);
  if (!leader || leader.raw === 0) {
    return {
      headline: "Your interview is complete.",
      note: "Your answers didn't land clearly on any one tribe yet. As the Interview grows longer in a later slice, the read will sharpen.",
    };
  }

  return {
    headline: `Your strongest read is ${leader.name}.`,
    note: `Based on how you answered, ${leader.name} scored highest so far (${Math.round(leader.percentage)}% of your profile). This is a provisional read — the full Primary and Contenders result, with the confidence logic behind it, arrives in a later slice.`,
  };
}
