import { tribes } from "@/lib/tribes";
import { applyDeltas, derivePrimarySlug, normalizeProfile, type MarkerLookup } from "./scoring";
import type {
  InterviewResult,
  InterviewState,
  NextTurn,
  ScoreDelta,
  StrengthProfile,
} from "./types";

/**
 * Pure Interview flow logic (PRD #13).
 *
 * The questions are now LLM-produced and answers are scored against the Marker
 * Catalog (slice #16) — but this module stays pure: the agent call and the
 * catalog live in `agent`/`markers`, and the deltas they produce are *injected*
 * here. This keeps "what to show next" and "how to fold an answer in" a testable
 * seam, free of the LLM and DB.
 *
 * This slice scores a single open-ended Turn and then completes; the multi-Turn
 * loop and Confidence/Stop evaluator arrive in slice #17.
 */

/** A fresh, zeroed Strength Profile covering all 12 tribes, keyed by slug. */
export function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) {
    profile[tribe.slug] = 0;
  }
  return profile;
}

/**
 * The initial server-authoritative state for a newly created Session. The
 * opening question is LLM-produced, so it is passed in and parked as the pending
 * question; a refresh re-derives the same question from this persisted state.
 */
export function initialState(openingQuestion: string): InterviewState {
  return {
    status: "in_progress",
    turns: [],
    profile: emptyProfile(),
    trace: [],
    pendingQuestion: openingQuestion,
  };
}

/**
 * Decide what to show the participant next, derived purely from current state.
 * This is what makes the flow resumable: a reload re-derives the right view from
 * the persisted Session rather than trusting anything held on the client.
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete") {
    return { kind: "result" };
  }
  if (state.pendingQuestion) {
    return {
      kind: "question",
      prompt: state.pendingQuestion,
      questionNumber: state.turns.length + 1,
    };
  }
  // In progress but no pending question is a degenerate state (a Session is
  // always created with an opening question); treat it as needing to restart.
  return { kind: "result" };
}

/**
 * Fold a free-text answer and the Markers the agent cited for it into the state,
 * returning a new state (no mutation). Records the Turn against the question
 * that was pending, applies the cited deltas to the Strength Profile via the
 * pure scoring engine, appends to the trace, and — in this single-Turn slice —
 * marks the Session complete. A completed Session ignores further answers.
 */
export function recordScoredAnswer(
  state: InterviewState,
  answer: string,
  deltas: readonly ScoreDelta[],
  lookup: MarkerLookup,
): InterviewState {
  if (state.status === "complete" || !state.pendingQuestion) {
    return state;
  }

  const turnIndex = state.turns.length;
  const { profile, entries } = applyDeltas(state.profile, deltas, {
    turnIndex,
    lookup,
  });

  return {
    status: "complete",
    turns: [...state.turns, { question: state.pendingQuestion, answer }],
    profile,
    trace: [...state.trace, ...entries],
    pendingQuestion: null,
  };
}

/**
 * The Interview result for a completed Session: the normalized Strength Profile
 * (display percentages, ADR-0002) plus the Primary tribe. Throws if asked before
 * completion.
 */
export function deriveResult(state: InterviewState): InterviewResult {
  if (state.status !== "complete") {
    throw new Error("Result requested for an Interview that is not complete.");
  }
  const primarySlug = derivePrimarySlug(state.profile) ?? tribes[0].slug;
  return { primarySlug, normalized: normalizeProfile(state.profile) };
}
