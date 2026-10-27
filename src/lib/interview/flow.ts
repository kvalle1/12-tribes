import { tribes } from "@/lib/tribes";
import { evaluate } from "./confidence";
import {
  CALIBRATION_QUESTIONS,
  OPENING_QUESTION,
  planNextTurn,
} from "./funnel";
import { applyDeltas } from "./scoring";
import type {
  InterviewState,
  InterviewTurn,
  MarkerDelta,
  NextTurn,
  PendingTurn,
  StrengthProfile,
} from "./types";

/**
 * Pure Interview flow logic: given a Session's state it decides what to show
 * next and how to fold in a scored answer, with no LLM and no persistence.
 *
 * Each Turn (slice 4, issue #17): the answer is recorded against the pending
 * Turn, its scored deltas are applied, and the Confidence / Stop evaluator
 * (ADR-0006) decides whether to report or ask again. When it asks again, the
 * **Funnel planner** (ADR-0005, slice 5) decides *what* to ask — the fixed
 * Calibration opening, a steered Discrimination question, or a Dilemma for a
 * stubborn tie. The model call itself happens in `repository.ts`; this module
 * only folds its output in.
 */

/** Re-exported for callers that still reference the opening question directly. */
export { OPENING_QUESTION };

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
    trace: [],
    pendingTurn: {
      kind: "question",
      phase: "calibration",
      prompt: CALIBRATION_QUESTIONS[0],
    },
    result: null,
  };
}

/**
 * Decide what to show the participant next, derived purely from current state.
 * This is what makes the flow resumable: a reload re-derives the right view
 * from the persisted Session rather than trusting anything held on the client.
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || state.pendingTurn === null) {
    return { kind: "result" };
  }
  const questionNumber = state.turns.length + 1;
  const pending = state.pendingTurn;
  if (pending.kind === "dilemma") {
    return { kind: "dilemma", dilemma: pending.dilemma, questionNumber };
  }
  return {
    kind: "question",
    phase: pending.phase,
    prompt: pending.prompt,
    questionNumber,
  };
}

/** What the scorer produced for one answer. */
export interface ScoredAnswer {
  deltas: readonly MarkerDelta[];
  nextQuestion: string | null;
}

/**
 * Fold a completed Turn and its scored deltas into the state, returning a new
 * state (no mutation). The Turn (already built by the caller — a free-text
 * question or a resolved Dilemma) is appended, its deltas applied, and the Stop
 * Condition decides between completing with a result and planning the next Turn
 * via the Funnel. Folding a Turn into a complete Session is a no-op.
 */
export function applyTurn(
  state: InterviewState,
  turn: InterviewTurn,
  scored: ScoredAnswer,
): InterviewState {
  if (state.status === "complete" || state.pendingTurn === null) {
    return state;
  }

  const turnIndex = state.turns.length;
  const turns = [...state.turns, turn];
  const applied = applyDeltas(state.profile, scored.deltas, turnIndex);
  const profile = applied.profile;
  const trace = [...state.trace, ...applied.trace];

  const verdict = evaluate(profile, trace, turns.length);
  if (verdict.decision === "stop") {
    return {
      status: "complete",
      turns,
      profile,
      trace,
      pendingTurn: null,
      result: verdict.result,
    };
  }

  const pendingTurn: PendingTurn = planNextTurn({
    turnsCompleted: turns.length,
    profile,
    trace,
    lastTurnWasDilemma: turn.dilemma !== undefined,
    proposedQuestion: scored.nextQuestion,
  });

  return {
    status: "in_progress",
    turns,
    profile,
    trace,
    pendingTurn,
    result: null,
  };
}
