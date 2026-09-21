import { tribes } from "@/lib/tribes";
import type {
  InterviewState,
  InterviewTurn,
  NextTurn,
  StrengthProfile,
  TraceEntry,
} from "./types";

/**
 * Pure Interview flow logic (client-safe: no LLM, no DB, no Marker Catalog).
 *
 * Slice #16 turns the walking skeleton into a real scored loop. The catalog and
 * the model call live in the server-only `agent`/`scoring` modules; this module
 * stays pure so it can be unit-tested and reasoned about on its own. It owns:
 *   • the fixed opening question (the first Turn is deterministic; the agent
 *     produces every subsequent question),
 *   • recording a Turn's answer against the question that was asked,
 *   • folding an already-scored Turn's profile + trace into the state and
 *     deciding whether the Session continues or completes.
 *
 * A fixed Turn cap (`MAX_TURNS`) stands in for the Confidence/Stop evaluator,
 * which replaces it in slice #17.
 */

/**
 * The deterministic opening question. Broad and neutral so it doesn't anchor the
 * participant toward any tribe; the Funnel's proper Calibration opening is
 * slice #19.
 */
export const OPENING_QUESTION =
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?";

/**
 * How many Turns the Interview runs before completing. A placeholder for the
 * Confidence/Stop evaluator (slice #17): enough Turns that at least one question
 * is agent-produced, so the LLM-driven question path is exercised.
 */
export const MAX_TURNS = 3;

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
    currentQuestion: OPENING_QUESTION,
  };
}

/**
 * Decide what to show next, derived purely from current state — the basis for
 * resume (a reload re-derives the view from the persisted Session). While in
 * progress, the prompt is whatever question is currently pending (`OPENING_QUESTION`
 * on the first Turn, then the agent's last-produced question).
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || !state.currentQuestion) {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: state.currentQuestion,
    questionNumber: state.turns.length + 1,
    totalQuestions: MAX_TURNS,
  };
}

/**
 * Record a free-text answer against the question currently being asked, without
 * mutating the input. Returns the state unchanged if the Session is already
 * complete or has no pending question (answering again is a no-op rather than
 * corrupting history). Scoring happens separately via `finalizeScoredTurn`.
 */
export function appendTurn(state: InterviewState, answer: string): InterviewState {
  if (state.status === "complete" || !state.currentQuestion) {
    return state;
  }
  const turn: InterviewTurn = { question: state.currentQuestion, answer };
  return { ...state, turns: [...state.turns, turn] };
}

/** The index into `turns` of the most recently appended answer. */
export function lastTurnIndex(state: InterviewState): number {
  return state.turns.length - 1;
}

export interface ScoredTurnUpdate {
  /** The profile after this Turn's cited deltas were applied. */
  profile: StrengthProfile;
  /** The trace entries produced by this Turn (appended to the running trace). */
  newTrace: TraceEntry[];
  /** The agent's next question, used only if the Session continues. */
  nextQuestion: string;
}

/**
 * Fold an already-scored Turn (its applied profile and new trace) into the
 * state and decide whether to continue or complete. Completes once `MAX_TURNS`
 * answers have been recorded, clearing the pending question; otherwise sets the
 * agent's next question. Pure — the caller supplies the scoring result computed
 * by the server-only engine.
 */
export function finalizeScoredTurn(
  state: InterviewState,
  update: ScoredTurnUpdate,
): InterviewState {
  const trace = [...state.trace, ...update.newTrace];
  const complete = state.turns.length >= MAX_TURNS;
  return {
    ...state,
    profile: update.profile,
    trace,
    status: complete ? "complete" : "in_progress",
    currentQuestion: complete ? null : update.nextQuestion,
  };
}
