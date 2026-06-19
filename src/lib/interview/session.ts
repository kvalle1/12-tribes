/**
 * Interview Session — the pure, server-side state machine for one Interview run.
 *
 * This module owns the *shape* and *transitions* of a Session (Turn history,
 * counts, running profile placeholder) with no I/O: persistence and auth live in
 * the route layer (`src/app/interview`). Keeping the loop pure makes it unit-
 * testable without a database and keeps scoring state server-authoritative
 * (ADR-0009) — the only thing handed to the client is the {@link ParticipantView}
 * from {@link presentView}, which deliberately omits the running profile so the
 * instrument is not gameable.
 *
 * This is the walking-skeleton slice (#14): no LLM and no real scoring. The
 * question script is a single hardcoded question and the running profile is an
 * empty placeholder. Later slices replace the script with agent-chosen Turns and
 * fill in the Strength Profile, reusing this state machine's contract.
 */

/** A completed question-and-answer exchange — the unit of the Interview loop. */
export interface Turn {
  /** 0-based position of this Turn within the interview. */
  index: number;
  /** The question the participant was shown. */
  prompt: string;
  /** The participant's free-text answer. */
  answer: string;
}

export type SessionStatus = "in_progress" | "complete";

/**
 * The server-authoritative state of one Interview run. Persisted every Turn so a
 * refresh or closed tab resumes where the participant left off (ADR-0011). The
 * `profile` is server-only and never shipped to the client.
 */
export interface InterviewSession {
  id: string;
  /** The participant — ties resume/report to the account model (ADR-0011). */
  userId: string;
  status: SessionStatus;
  /** Completed Q&A exchanges, in order. */
  turns: Turn[];
  /** The question awaiting an answer; `null` when none is pending / complete. */
  pendingPrompt: string | null;
  /**
   * Running Strength Profile placeholder (server-only). Empty in this slice;
   * real per-tribe scoring arrives in a later slice (#16).
   */
  profile: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What the participant is allowed to see — the only projection of a Session that
 * crosses to the client. It carries no scoring state by construction (ADR-0009).
 */
export type ParticipantView =
  | { kind: "question"; index: number; prompt: string; answeredCount: number }
  | { kind: "complete"; answeredCount: number };

/** Raised when a transition is attempted against an invalid Session state. */
export class InterviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterviewError";
  }
}

/**
 * The Interview's question script. A walking skeleton has exactly one hardcoded
 * question; a later slice replaces this with Turns the agent chooses per answer.
 * Modeling it as a list keeps {@link recordAnswer}'s "next prompt or complete?"
 * logic unchanged when more questions arrive.
 */
export const QUESTION_SCRIPT: readonly string[] = [
  "Tell me about a recent moment when you felt most like yourself — what were you doing, and what made it feel right?",
];

/** Convenience alias for the opening question. */
export const FIRST_QUESTION = QUESTION_SCRIPT[0];

/** Begin a new Interview: the first question is pending, nothing answered yet. */
export function startSession(args: {
  id: string;
  userId: string;
  now: Date;
}): InterviewSession {
  return {
    id: args.id,
    userId: args.userId,
    status: "in_progress",
    turns: [],
    pendingPrompt: QUESTION_SCRIPT[0],
    profile: {},
    createdAt: args.now,
    updatedAt: args.now,
  };
}

/**
 * Record the participant's answer to the pending question, returning the next
 * Session state. Pure — the input session is not mutated. After the last scripted
 * question the Session transitions to `complete`.
 */
export function recordAnswer(
  session: InterviewSession,
  answer: string,
  now: Date,
): InterviewSession {
  if (session.status === "complete") {
    throw new InterviewError("Cannot answer a completed interview.");
  }
  if (session.pendingPrompt === null) {
    throw new InterviewError("There is no question awaiting an answer.");
  }

  const trimmed = answer.trim();
  if (trimmed.length === 0) {
    throw new InterviewError("An answer is required.");
  }

  const turns: Turn[] = [
    ...session.turns,
    { index: session.turns.length, prompt: session.pendingPrompt, answer: trimmed },
  ];

  const nextPrompt = QUESTION_SCRIPT[turns.length] ?? null;

  return {
    ...session,
    turns,
    pendingPrompt: nextPrompt,
    status: nextPrompt === null ? "complete" : "in_progress",
    updatedAt: now,
  };
}

/** Project a Session into the participant-facing view (no scoring state). */
export function presentView(session: InterviewSession): ParticipantView {
  if (session.status === "complete" || session.pendingPrompt === null) {
    return { kind: "complete", answeredCount: session.turns.length };
  }

  return {
    kind: "question",
    index: session.turns.length,
    prompt: session.pendingPrompt,
    answeredCount: session.turns.length,
  };
}
