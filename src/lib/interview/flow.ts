import { tribes } from "@/lib/tribes";
import type {
  InterviewState,
  InterviewTurn,
  NextTurn,
  StrengthProfile,
  StubResult,
} from "./types";

/**
 * Pure Interview flow logic: given a Session's state it decides what to show
 * next and how to fold in a new answer, with no LLM and no persistence.
 *
 * Real Marker scoring (slice 3, issue #16) lives in `agent.ts` + `scoring.ts`
 * and is driven from `repository.ts` as each answer is recorded — this module
 * stays pure. The opening question is still authored and a single Turn
 * completes the Session; the Funnel planner and the multi-Turn Confidence/Stop
 * loop arrive in later slices (ADRs 0005/0006).
 */

/**
 * The hardcoded questions for this slice. A single open-ended Turn is enough to
 * prove the loop; keeping it an array means later slices generalize the flow
 * without changing its shape.
 */
export const QUESTIONS: readonly string[] = [
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?",
];

export const TOTAL_QUESTIONS = QUESTIONS.length;

const STUB_RESULT: StubResult = {
  headline: "Your interview is complete.",
  note: "Scoring isn't wired in yet — this is a placeholder result. A future slice will read your answers and report your tribe.",
};

/** A fresh, zeroed strength profile covering all 12 tribes (placeholder this slice). */
export function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) {
    profile[tribe.slug] = 0;
  }
  return profile;
}

/** The initial server-authoritative state for a newly created Session. */
export function initialState(): InterviewState {
  return { status: "in_progress", turns: [], profile: emptyProfile(), trace: [] };
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
 * Fold a free-text answer into the state, returning a new state (no mutation).
 * Records the Turn against the question that was actually being asked and marks
 * the Session complete once the (single, in this slice) question is answered.
 */
export function appendAnswer(state: InterviewState, answer: string): InterviewState {
  if (state.status === "complete" || state.turns.length >= TOTAL_QUESTIONS) {
    // Already done — answering again is a no-op rather than corrupting history.
    return state;
  }

  const turn: InterviewTurn = {
    question: QUESTIONS[state.turns.length],
    answer,
  };
  const turns = [...state.turns, turn];
  const status: InterviewState["status"] =
    turns.length >= TOTAL_QUESTIONS ? "complete" : "in_progress";

  return { ...state, turns, status };
}

/** The stub result for a completed Session. Throws if asked before completion. */
export function stubResult(state: InterviewState): StubResult {
  if (state.status !== "complete") {
    throw new Error("Result requested for an Interview that is not complete.");
  }
  return STUB_RESULT;
}
