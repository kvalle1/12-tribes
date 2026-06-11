/**
 * The Interview Session state machine — pure and server-authoritative.
 *
 * One Turn is one question-and-answer exchange. This module owns the transition
 * "given the current state and an answer, produce the next state"; the route
 * handlers and Drizzle repository merely persist and replay it. Keeping it pure
 * means the loop's behaviour is unit-testable without the LLM, the database, or
 * a browser (CONTEXT.md "Session"; ADR-0009 server-authoritative loop).
 *
 * Slice 1 (issue #14) is a walking skeleton: the questions are a fixed
 * placeholder script and the running Strength Profile stays empty. Real
 * LLM-produced questions and scoring arrive in later slices (#15, #16) and slot
 * into the same shape.
 */

/**
 * A score per tribe (keyed by tribe slug) for how strongly the participant
 * expresses that tribe's wiring (CONTEXT.md "Strength Profile"). Empty in slice
 * 1 — it exists so persistence and the agent loop have a stable field to fill.
 */
export type StrengthProfile = Record<string, number>;

export type SessionStatus = "in_progress" | "complete";

/** One question-and-answer exchange; `answer` is null until the Turn is taken. */
export interface Turn {
  index: number;
  question: string;
  answer: string | null;
}

/**
 * The full server-side state of one Interview run — everything needed to
 * reconstruct it mid-flight after a refresh (ADR-0011). Persisted every Turn.
 */
export interface InterviewState {
  status: SessionStatus;
  profile: StrengthProfile;
  turns: Turn[];
  /** Number of answered Turns. */
  turnCount: number;
}

/**
 * Fixed placeholder questions for the walking skeleton. Deliberately broad,
 * Calibration-style prompts so the flow feels real; they carry no scoring and
 * are replaced by agent-generated questions in #16.
 */
export const PLACEHOLDER_QUESTIONS: readonly string[] = [
  "When you walk into a room full of strangers, what do you find yourself doing?",
  "Tell me about a recent moment when you felt most like yourself.",
  "What is something people consistently come to you for?",
];

/** Begin a fresh Interview: the first question queued, nothing answered yet. */
export function startInterview(): InterviewState {
  return {
    status: "in_progress",
    profile: {},
    turns: [{ index: 0, question: PLACEHOLDER_QUESTIONS[0], answer: null }],
    turnCount: 0,
  };
}

/**
 * The Turn currently awaiting an answer, or `null` once the Interview is
 * complete. This is what a (re)load renders, so resume lands on the right point.
 */
export function currentTurn(state: InterviewState): Turn | null {
  if (state.status === "complete") return null;
  return state.turns[state.turns.length - 1];
}

/**
 * Record the answer to the current Turn and advance: queue the next question,
 * or mark the Interview complete after the last one. Returns a new state and
 * never mutates the input. Throws if the Interview is already complete.
 */
export function recordAnswer(
  state: InterviewState,
  answer: string,
): InterviewState {
  if (state.status === "complete") {
    throw new Error("Cannot record an answer: the Interview is already complete.");
  }

  const currentIndex = state.turns.length - 1;
  const answeredTurns = state.turns.map((turn, i) =>
    i === currentIndex ? { ...turn, answer } : turn,
  );

  const nextIndex = currentIndex + 1;
  const isComplete = nextIndex >= PLACEHOLDER_QUESTIONS.length;

  return {
    status: isComplete ? "complete" : "in_progress",
    profile: { ...state.profile },
    turns: isComplete
      ? answeredTurns
      : [
          ...answeredTurns,
          { index: nextIndex, question: PLACEHOLDER_QUESTIONS[nextIndex], answer: null },
        ],
    turnCount: answeredTurns.length,
  };
}
