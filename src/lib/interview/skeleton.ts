import { tribes } from "@/lib/tribes";

/**
 * The walking-skeleton core of the Interview (issue #14).
 *
 * This is the pure, server-authoritative state logic for an Interview Session —
 * no LLM, no scoring, no database. It proves the Turn loop and, crucially, the
 * *resume* path: every function takes a `SessionState` and returns a new one, so
 * a state reconstructed from Postgres behaves identically to one held in memory
 * (ADR-0009 server-authoritative, ADR-0011 resumable).
 *
 * Real scoring against the Marker Catalog replaces the hardcoded script in later
 * slices (#15, #16); the shapes here (running profile, Turn history, counts) are
 * deliberately the ones a Session must persist to be reconstructable mid-flight.
 */

/**
 * A per-tribe Strength Profile, keyed by tribe `slug`. The canonical output
 * shape of every instrument (ADR-0002). In the skeleton it is a placeholder of
 * zeros — no answer moves it yet — but it is carried through the Session so the
 * persistence and resume paths handle the real shape from day one.
 */
export type StrengthProfile = Record<string, number>;

/** One completed Turn: the question asked and the participant's free-text answer. */
export interface TurnRecord {
  index: number;
  question: string;
  answer: string;
}

export type SessionStatus = "in_progress" | "complete";

/**
 * Everything needed to reconstruct an Interview Session mid-flight. This is the
 * server-authoritative state; the client never holds or mutates it (ADR-0009).
 */
export interface SessionState {
  profile: StrengthProfile;
  turns: TurnRecord[];
  turnCount: number;
  status: SessionStatus;
}

/** The next thing the Interview wants from the participant, or a signal to stop. */
export type NextTurn =
  | { kind: "question"; index: number; prompt: string }
  | { kind: "stop" };

/**
 * The hardcoded script for the skeleton: a single broad opening question. Later
 * slices replace this with LLM-chosen Turns driven by the Funnel (#19).
 */
export const SKELETON_QUESTIONS: readonly string[] = [
  "When you're at your best, what are you usually doing — and what about it makes it feel like you?",
];

/** Total Turns in the (hardcoded) skeleton script. */
export const TOTAL_TURNS = SKELETON_QUESTIONS.length;

/** A Strength Profile with every tribe present and zeroed, from the source of truth. */
export function initialProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) {
    profile[tribe.slug] = 0;
  }
  return profile;
}

/** The starting state of a fresh Interview Session, before any Turn. */
export function createInitialState(): SessionState {
  return {
    profile: initialProfile(),
    turns: [],
    turnCount: 0,
    status: "in_progress",
  };
}

/** Whether the Session has run through the whole script. */
export function isComplete(state: SessionState): boolean {
  return state.turnCount >= TOTAL_TURNS;
}

/**
 * The next Turn for a given state. Because it derives purely from `turnCount`,
 * a state loaded from Postgres resumes at exactly the Turn it left off on.
 */
export function nextTurn(state: SessionState): NextTurn {
  if (isComplete(state)) {
    return { kind: "stop" };
  }
  return {
    kind: "question",
    index: state.turnCount,
    prompt: SKELETON_QUESTIONS[state.turnCount],
  };
}

/**
 * Record an answer to the current Turn and advance the Session. Returns a new
 * state (the input is not mutated). Throws if the Session is already complete —
 * a stale or replayed submission must not append a phantom Turn.
 */
export function recordAnswer(state: SessionState, answer: string): SessionState {
  if (isComplete(state)) {
    throw new Error("Cannot record an answer: the Interview is already complete.");
  }

  const turn: TurnRecord = {
    index: state.turnCount,
    question: SKELETON_QUESTIONS[state.turnCount],
    answer,
  };

  const turnCount = state.turnCount + 1;

  return {
    profile: state.profile,
    turns: [...state.turns, turn],
    turnCount,
    status: turnCount >= TOTAL_TURNS ? "complete" : "in_progress",
  };
}
