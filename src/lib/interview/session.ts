import { tribes } from "@/lib/tribes";

/**
 * Interview session core — slice 1 walking skeleton.
 *
 * Pure, server-side Turn-progression logic with no LLM, no scoring, and no
 * database. The Interview is server-authoritative (ADR-0009): this module owns
 * how a Session advances from Turn to Turn, and the route/UI layers wrap it.
 * For the skeleton there is a single hardcoded question and a placeholder
 * result; real scoring against the Marker Catalog arrives in later slices.
 */

/** A completed Turn: the question that was shown and the free-text answer given. */
export interface Turn {
  question: string;
  answer: string;
}

export type InterviewStatus = "in_progress" | "complete";

/**
 * A per-tribe running profile, keyed by tribe slug. A placeholder in this slice
 * (every tribe at 0); later slices accumulate real Strength Profile values here.
 */
export type RunningProfile = Record<string, number>;

/** Everything needed to reconstruct a Session mid-flight (ADR-0011). */
export interface InterviewState {
  status: InterviewStatus;
  turns: Turn[];
  turnCount: number;
  profile: RunningProfile;
}

/** The single hardcoded question for the walking skeleton. */
export const FIRST_QUESTION =
  "To get us started, tell me about a moment when you felt most like yourself. What were you doing, and why did it matter to you?";

/** How many questions the skeleton asks before completing. */
export const TOTAL_QUESTIONS = 1;

const QUESTIONS: readonly string[] = [FIRST_QUESTION];

/** A zeroed running profile with an entry for every tribe. */
export function emptyProfile(): RunningProfile {
  const profile: RunningProfile = {};
  for (const tribe of tribes) {
    profile[tribe.slug] = 0;
  }
  return profile;
}

/** A fresh, in-progress Session with no Turns recorded. */
export function createInitialState(): InterviewState {
  return {
    status: "in_progress",
    turns: [],
    turnCount: 0,
    profile: emptyProfile(),
  };
}

export function isComplete(state: InterviewState): boolean {
  return state.status === "complete";
}

/**
 * The question to show right now, or `null` when the interview is complete.
 * Driven by how many Turns have been answered so far.
 */
export function currentQuestion(state: InterviewState): string | null {
  if (isComplete(state)) return null;
  return QUESTIONS[state.turnCount] ?? null;
}

/**
 * Record an answer to the current question, returning a new state (the input is
 * never mutated). Throws if the interview is already complete or the answer is
 * blank. Completes the Session once the final question has been answered.
 */
export function recordAnswer(
  state: InterviewState,
  answer: string,
): InterviewState {
  const question = currentQuestion(state);
  if (question === null) {
    throw new Error("Cannot record an answer: the interview is already complete.");
  }

  const trimmed = answer.trim();
  if (trimmed.length === 0) {
    throw new Error("Cannot record an empty answer.");
  }

  const turns = [...state.turns, { question, answer: trimmed }];
  const turnCount = state.turnCount + 1;
  const status: InterviewStatus =
    turnCount >= TOTAL_QUESTIONS ? "complete" : "in_progress";

  return {
    status,
    turns,
    turnCount,
    profile: { ...state.profile },
  };
}
