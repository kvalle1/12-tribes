/**
 * Interview session — the pure, server-authoritative state machine.
 *
 * This module owns *what the participant is asked next* and *how an answer
 * advances the session*, with no knowledge of the database, HTTP, cookies, or
 * the LLM. The scoring slices (#16+) replace the hardcoded script and grow the
 * `profile`, but the resume/advance contract stays here so it can be unit-tested
 * without a server runtime (ADR-0009: scoring state is server-authoritative and
 * never client-trusted; ADR-0011: per-Turn history makes a Session resumable).
 */

/** Cookie holding the active interview session id (server-set, httpOnly). */
export const INTERVIEW_SESSION_COOKIE = "interview_session";

export type InterviewStatus = "in_progress" | "complete";

/** One answered Turn: the question put to the participant and their reply. */
export interface InterviewTurn {
  index: number;
  question: string;
  answer: string;
}

/**
 * The reconstructable Session state (ADR-0011). `profile` is a placeholder in
 * this walking skeleton — no scoring runs yet — but it travels with the state
 * so the persistence layer and later slices have a stable shape to grow into.
 */
export interface InterviewState {
  turns: InterviewTurn[];
  turnCount: number;
  status: InterviewStatus;
}

/**
 * The scripted questions for the walking skeleton. A single hardcoded prompt
 * for now; slice #16 replaces this with LLM-produced, adaptive questions. The
 * length defines when the skeleton interview is "done".
 */
export const INTERVIEW_QUESTIONS: readonly string[] = [
  "Think of a recent moment when you felt most like yourself. What were you doing, who was around, and why did it matter to you?",
];

export function initialState(): InterviewState {
  return { turns: [], turnCount: 0, status: "in_progress" };
}

export function isComplete(state: InterviewState): boolean {
  return state.status === "complete";
}

/**
 * The question to put to the participant right now, or `null` when the
 * interview has run out of scripted questions (i.e. it is complete).
 */
export function currentQuestion(state: InterviewState): string | null {
  if (isComplete(state)) return null;
  return INTERVIEW_QUESTIONS[state.turnCount] ?? null;
}

/**
 * Advance the session by recording the participant's answer to the current
 * question. Returns a new state (the input is never mutated). Answering a
 * session that is already complete — or that has no current question — is a
 * no-op, so a double-submit on a refresh can't overrun the script.
 */
export function recordAnswer(
  state: InterviewState,
  answer: string,
): InterviewState {
  const question = currentQuestion(state);
  if (question === null) return state;

  const turns: InterviewTurn[] = [
    ...state.turns,
    { index: state.turnCount, question, answer },
  ];
  const turnCount = state.turnCount + 1;
  const status: InterviewStatus =
    turnCount >= INTERVIEW_QUESTIONS.length ? "complete" : "in_progress";

  return { turns, turnCount, status };
}
