import { tribes } from "@/lib/tribes";

/**
 * Pure server-authoritative Interview session state and transitions (ADR-0009).
 *
 * Slice 1 (the walking skeleton) has no LLM and no real scoring: a single
 * hardcoded question, after which the stubbed interview is "complete". The
 * `profile` / `posture` fields are zeroed placeholders that later slices fill
 * in. Keeping these transitions pure means the route handlers / Server Actions
 * stay thin (load row → apply transition → save row) and the state machine is
 * unit-testable without a database or the model.
 */

/** Slice 1 only produces hardcoded question turns; other kinds arrive later. */
export type TurnKind = "question";

export interface Turn {
  index: number;
  kind: TurnKind;
  prompt: string;
  /** The participant's free-text answer, or null while the turn is open. */
  answer: string | null;
  askedAt: string;
  answeredAt: string | null;
}

/** A per-tribe score, keyed by tribe slug. The shared output shape (ADR-0002). */
export type StrengthProfile = Record<string, number>;

export type SessionStatus = "in_progress" | "complete";

export interface InterviewSessionState {
  status: SessionStatus;
  /** Running Strength Profile placeholder; zeroed in slice 1. */
  profile: StrengthProfile;
  /** Running Posture tallies placeholder; zeroed in slice 1. */
  posture: StrengthProfile;
  turns: Turn[];
  /** Number of answered turns. */
  turnCount: number;
}

/** Name of the httpOnly cookie that holds the opaque session id (not state). */
export const SESSION_COOKIE = "interview_session";

/** The single hardcoded question for the walking skeleton (slice 1). */
export const FIRST_QUESTION =
  "To start, tell me about a moment when you felt most like yourself — what were you doing, and why did it matter to you?";

/** Slice 1 is a single-turn skeleton: one question, then the stub result. */
export const TOTAL_TURNS = 1;

/** A Strength Profile with a zeroed entry for every tribe (keyed by slug). */
export function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) {
    profile[tribe.slug] = 0;
  }
  return profile;
}

export function createInitialSession(now: Date = new Date()): InterviewSessionState {
  return {
    status: "in_progress",
    profile: emptyProfile(),
    posture: emptyProfile(),
    turnCount: 0,
    turns: [
      {
        index: 0,
        kind: "question",
        prompt: FIRST_QUESTION,
        answer: null,
        askedAt: now.toISOString(),
        answeredAt: null,
      },
    ],
  };
}

/** The first turn still awaiting an answer, or null if none is open. */
export function currentTurn(session: InterviewSessionState): Turn | null {
  return session.turns.find((turn) => turn.answer === null) ?? null;
}

export function isComplete(session: InterviewSessionState): boolean {
  return session.status === "complete";
}

/**
 * Record the participant's answer to the open turn, returning a new session
 * state (the input is never mutated). In slice 1 a single answered turn
 * completes the interview.
 */
export function recordAnswer(
  session: InterviewSessionState,
  answer: string,
  now: Date = new Date(),
): InterviewSessionState {
  const trimmed = answer.trim();
  if (trimmed.length === 0) {
    throw new Error("An answer must not be empty.");
  }

  const open = currentTurn(session);
  if (!open) {
    throw new Error("There is no open turn to answer.");
  }

  const turns = session.turns.map((turn) =>
    turn.index === open.index
      ? { ...turn, answer: trimmed, answeredAt: now.toISOString() }
      : turn,
  );
  const turnCount = session.turnCount + 1;
  const status: SessionStatus = turnCount >= TOTAL_TURNS ? "complete" : "in_progress";

  return { ...session, turns, turnCount, status };
}
