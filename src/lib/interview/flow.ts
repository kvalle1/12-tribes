import { tribes } from "@/lib/tribes";
import type {
  InterviewState,
  InterviewTurn,
  NextTurn,
  PostureProfile,
  StrengthProfile,
  StubResult,
} from "./types";

/**
 * Pure Interview flow logic.
 *
 * Slice 1 (#14) proved the resumable loop with a hardcoded question and a stub
 * result. Slice 3 (#16) keeps this module as the pure state seam — it decides
 * what to show next and records the answered Turn — but the *question* is now
 * produced by the LLM (stored per-Session) and the *scoring* of an answer is
 * done by the Scoring engine (`scoring.ts`); this module no longer owns either.
 *
 * Later slices grow `TOTAL_QUESTIONS` into the multi-Turn Funnel + Stop logic
 * (ADRs 0005/0006); the shape here is deliberately loop-ready.
 */

/**
 * How many Turns the Interview runs. Slice 3 scores a single open-ended
 * question→score→update Turn (the multi-Turn loop and Stop condition arrive in
 * slice 4), so the whole flow is one Turn deep for now.
 */
export const TOTAL_QUESTIONS = 1;

const STUB_RESULT: StubResult = {
  headline: "Your interview is complete.",
  note: "This is an early single-question read — your Strength Profile below is scored from your answer against the Marker Catalog. Later slices ask more and name a Primary tribe.",
};

/** A fresh, zeroed strength profile covering all 12 tribes. */
export function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) {
    profile[tribe.slug] = 0;
  }
  return profile;
}

/** A fresh, zeroed Posture tally covering all 12 tribes (ADR-0004). */
export function emptyPosture(): PostureProfile {
  const posture: PostureProfile = {};
  for (const tribe of tribes) {
    posture[tribe.slug] = 0;
  }
  return posture;
}

/** The initial server-authoritative state for a newly created Session. */
export function initialState(): InterviewState {
  return {
    status: "in_progress",
    turns: [],
    profile: emptyProfile(),
    posture: emptyPosture(),
    trace: [],
  };
}

/**
 * Decide what to show the participant next, derived purely from current state.
 * This is what makes the flow resumable: a reload re-derives the right view from
 * the persisted Session. The question text itself is the Session's LLM-produced
 * `pendingQuestion`, passed in rather than derived here.
 */
export function nextTurn(
  state: InterviewState,
  pendingQuestion: string | null,
): NextTurn {
  if (state.status === "complete" || state.turns.length >= TOTAL_QUESTIONS) {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: pendingQuestion ?? "",
    questionNumber: state.turns.length + 1,
    totalQuestions: TOTAL_QUESTIONS,
  };
}

/**
 * Fold a free-text answer into the state, returning a new state (no mutation).
 * Records the Turn against the `question` that was actually asked (the LLM's
 * `pendingQuestion`) and marks the Session complete once the last Turn is
 * answered. Scoring the answer into `profile`/`posture`/`trace` is a separate
 * step (`applyScoring`) the caller runs with the LLM's cited deltas.
 */
export function appendAnswer(
  state: InterviewState,
  question: string,
  answer: string,
): InterviewState {
  if (state.status === "complete" || state.turns.length >= TOTAL_QUESTIONS) {
    // Already done — answering again is a no-op rather than corrupting history.
    return state;
  }

  const turn: InterviewTurn = { question, answer };
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
