import { tribes } from "@/lib/tribes";
import type { AppliedDelta } from "./score";
import type {
  InterviewState,
  InterviewTurn,
  NextTurn,
  StrengthProfile,
  StubResult,
} from "./types";

/**
 * Pure Interview flow logic (issue #16). It decides what to show next and folds
 * a scored answer into the state — no LLM, no DB, so it stays testable.
 *
 * The opening question is fixed (a broad, tribe-neutral warm-up); every question
 * after it is produced by the agent alongside the answer's score (ADR-0009), so
 * questions live on the state rather than in a static array.
 *
 * The number of Turns is a simple fixed cap in this slice. Slice 4 (issue #17)
 * replaces `MAX_QUESTIONS` with the Confidence/Stop evaluator (min floor,
 * evidence-relative margin, ranking stability, hard cap).
 */

/** The fixed opening Turn — broad enough that it doesn't telegraph any tribe. */
export const OPENING_QUESTION =
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?";

/** Placeholder Turn cap for this slice; replaced by the Stop evaluator in issue #17. */
export const MAX_QUESTIONS = 5;

const STUB_RESULT: StubResult = {
  headline: "Your interview is complete.",
  note: "Your answers have been scored against the Marker Catalog. The full result — your Primary tribe and Contenders — is wired up in a later slice.",
};

/** A fresh, zeroed strength profile covering all 12 tribes. */
export function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) {
    profile[tribe.slug] = 0;
  }
  return profile;
}

/** The initial server-authoritative state for a newly created Session. */
export function initialState(): InterviewState {
  return {
    status: "in_progress",
    turns: [],
    profile: emptyProfile(),
    currentQuestion: OPENING_QUESTION,
  };
}

/**
 * Decide what to show the participant next, derived purely from current state.
 * This is what makes the flow resumable: a reload re-derives the right view from
 * the persisted Session rather than trusting anything held on the client.
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || state.turns.length >= MAX_QUESTIONS) {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: state.currentQuestion,
    questionNumber: state.turns.length + 1,
    totalQuestions: MAX_QUESTIONS,
  };
}

/**
 * Fold a scored answer into the state, returning a new state (no mutation). The
 * answer is recorded against the question that was actually being asked, along
 * with its score trace and the updated profile; `nextQuestion` becomes the
 * question for the following Turn. The Session completes once the Turn cap is
 * reached (at which point `nextQuestion` is unused).
 */
export function recordScoredTurn(
  state: InterviewState,
  scored: {
    answer: string;
    trace: AppliedDelta[];
    profile: StrengthProfile;
    nextQuestion: string;
  },
): InterviewState {
  if (state.status === "complete" || state.turns.length >= MAX_QUESTIONS) {
    // Already done — scoring again is a no-op rather than corrupting history.
    return state;
  }

  const turn: InterviewTurn = {
    question: state.currentQuestion,
    answer: scored.answer,
    trace: scored.trace,
  };
  const turns = [...state.turns, turn];
  const complete = turns.length >= MAX_QUESTIONS;

  return {
    status: complete ? "complete" : "in_progress",
    turns,
    profile: scored.profile,
    currentQuestion: complete ? state.currentQuestion : scored.nextQuestion,
  };
}

/** The stub result for a completed Session. Throws if asked before completion. */
export function stubResult(state: InterviewState): StubResult {
  if (state.status !== "complete") {
    throw new Error("Result requested for an Interview that is not complete.");
  }
  return STUB_RESULT;
}
