import { emptyProfile } from "./scoring";
import type {
  AppliedDelta,
  InterviewState,
  InterviewTurn,
  NextTurn,
  StrengthProfile,
} from "./types";

/**
 * Pure Interview flow logic (issue #16). No LLM and no DB here — this is the
 * testable seam that decides, from a Session's state alone, what to show next
 * and how to fold a scored answer in. The Claude call and the Scoring engine
 * live in the repository/agent layer; keeping the transitions pure means a
 * reload can re-derive the right view from the persisted Session (ADR-0011)
 * without trusting anything on the client (ADR-0009).
 *
 * Slice #16 runs a fixed number of Turns: a neutral opener, then agent-produced
 * follow-up questions. The Confidence/Stop evaluator that ends the interview
 * when it is confident (ADR-0006) is slice #17; here completion is a fixed cap.
 */

export { emptyProfile };

/** The fixed opening question. Calibration/Funnel question selection is slice #19. */
export const OPENING_QUESTION =
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?";

/**
 * How many Turns the interview runs before completing. A fixed cap this slice —
 * the opener plus agent-produced follow-ups — standing in for the real
 * Confidence/Stop condition (ADR-0006, slice #17).
 */
export const INTERVIEW_TURN_COUNT = 2;

/** The initial server-authoritative state for a newly created Session. */
export function initialState(): InterviewState {
  return {
    status: "in_progress",
    turns: [],
    profile: emptyProfile(),
    nextQuestion: null,
  };
}

/**
 * The question to show for the current (unanswered) Turn: the fixed opener
 * before any answer, then the agent-produced question stored when the last
 * answer was scored.
 */
export function currentQuestion(state: InterviewState): string {
  if (state.turns.length === 0) return OPENING_QUESTION;
  return state.nextQuestion ?? OPENING_QUESTION;
}

/**
 * Decide what to show the participant next, derived purely from current state.
 * This is what makes the flow resumable: a reload re-derives the right view from
 * the persisted Session rather than trusting anything held on the client.
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || state.turns.length >= INTERVIEW_TURN_COUNT) {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: currentQuestion(state),
    questionNumber: state.turns.length + 1,
    totalQuestions: INTERVIEW_TURN_COUNT,
  };
}

/**
 * Fold a scored answer into the state, returning a new state (no mutation). The
 * caller has already run the Scoring engine (producing `profile` + `deltas`) and
 * the agent (producing `nextQuestion`); this only records the Turn and decides
 * whether the interview is complete. Answering an already-complete Session is a
 * no-op rather than corrupting history.
 */
export function appendScoredAnswer(
  state: InterviewState,
  scored: {
    question: string;
    answer: string;
    deltas: AppliedDelta[];
    profile: StrengthProfile;
    nextQuestion: string;
  },
): InterviewState {
  if (state.status === "complete" || state.turns.length >= INTERVIEW_TURN_COUNT) {
    return state;
  }

  const turn: InterviewTurn = {
    question: scored.question,
    answer: scored.answer,
    deltas: scored.deltas,
  };
  const turns = [...state.turns, turn];
  const status: InterviewState["status"] =
    turns.length >= INTERVIEW_TURN_COUNT ? "complete" : "in_progress";

  return {
    status,
    turns,
    profile: scored.profile,
    nextQuestion: scored.nextQuestion,
  };
}
