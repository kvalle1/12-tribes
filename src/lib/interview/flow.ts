import "server-only";

import { tribes } from "@/lib/tribes";
import { applyMarkerDeltas, type ScoringState } from "./scoring";
import type {
  InterviewState,
  InterviewTurn,
  MarkerDelta,
  NextTurn,
  StrengthProfile,
} from "./types";

/**
 * Pure Interview flow logic (slice #16). Given a Session's state it decides what
 * to show next and how to fold a scored answer back in — the testable seam
 * between the UI, the LLM scoring agent, and persistence.
 *
 * This slice wires in **real** scoring: an answer is interpreted against the
 * Marker Catalog and the resulting deltas grow the Strength Profile (via the pure
 * Scoring engine), replacing slice #14's placeholder. The opener is a fixed
 * Calibration question (ADR-0005); every subsequent question is produced by the
 * agent. The `server-only` import lands here transitively through the Scoring
 * engine anyway, and is stated explicitly to keep the trust boundary visible.
 */

/**
 * The fixed Calibration opener (ADR-0005): a deliberately broad first question
 * that gives every tribe a fair look before the agent narrows in. Fixed by
 * design — the agent produces every *subsequent* question.
 */
export const CALIBRATION_OPENER =
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?";

/**
 * A placeholder hard cap on Turns. This slice proves real per-Turn scoring; the
 * adaptive Confidence/Stop evaluator that ends the Interview on its own — a
 * minimum floor, an evidence-relative margin, ranking stability, and this cap as
 * the backstop (ADR-0006) — is slice #17. Until then the fixed cap bounds the loop.
 */
export const MAX_QUESTIONS = 3;

/** A fresh, zeroed Strength Profile covering all 12 tribes. */
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
    traces: [],
    pendingQuestion: CALIBRATION_OPENER,
  };
}

/**
 * Decide what to show the participant next, derived purely from current state.
 * This is what makes the flow resumable: a reload re-derives the right view from
 * the persisted Session — including the agent-produced pending question — rather
 * than trusting anything held on the client.
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || state.turns.length >= MAX_QUESTIONS) {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: state.pendingQuestion ?? CALIBRATION_OPENER,
    questionNumber: state.turns.length + 1,
    totalQuestions: MAX_QUESTIONS,
  };
}

/**
 * Fold a scored answer into the state, returning a new state (no mutation).
 *
 * Applies the agent's cited Marker deltas to the Strength Profile (additive;
 * ADR-0004), records the completed Turn against the question that was actually
 * being asked, keeps the resulting traces, and either queues the agent's next
 * question or completes the Interview at the cap. The LLM call that produced
 * `deltas`/`nextQuestion` and the persistence around it live in the server
 * repository; this is the pure state transition.
 */
export function recordScoredAnswer(
  state: InterviewState,
  answer: string,
  deltas: readonly MarkerDelta[],
  nextQuestion: string,
): InterviewState {
  if (state.status === "complete" || state.turns.length >= MAX_QUESTIONS) {
    // Already done — scoring again is a no-op rather than corrupting history.
    return state;
  }

  const turnIndex = state.turns.length;
  const question = state.pendingQuestion ?? CALIBRATION_OPENER;

  const scored: ScoringState = applyMarkerDeltas(
    { profile: state.profile, traces: state.traces },
    turnIndex,
    deltas,
  );

  const turn: InterviewTurn = { question, answer };
  const turns = [...state.turns, turn];
  const status: InterviewState["status"] =
    turns.length >= MAX_QUESTIONS ? "complete" : "in_progress";

  return {
    status,
    turns,
    profile: scored.profile,
    traces: scored.traces,
    pendingQuestion: status === "complete" ? null : nextQuestion,
  };
}
