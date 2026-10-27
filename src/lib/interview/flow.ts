import { tribes } from "@/lib/tribes";
import { evaluate } from "./confidence";
import { applyDeltas } from "./scoring";
import type {
  InterviewState,
  InterviewTurn,
  MarkerDelta,
  NextTurn,
  StrengthProfile,
} from "./types";

/**
 * Pure Interview flow logic: given a Session's state it decides what to show
 * next and how to fold in a scored answer, with no LLM and no persistence.
 *
 * Each Turn (slice 4, issue #17): the answer is recorded against the pending
 * question, its scored deltas are applied, and the Confidence / Stop evaluator
 * (ADR-0006) decides whether to report or ask the agent's proposed next
 * question. The model call itself happens in `repository.ts`; this module only
 * folds its output in. The Funnel planner (ADR-0005) arrives in a later slice.
 */

/** The authored opening question every Interview starts with. */
export const OPENING_QUESTION =
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?";

/**
 * Neutral, broad questions used only if the agent fails to propose one, so a
 * missing `nextQuestion` never stalls the loop. Cycled by Turn number.
 */
export const FALLBACK_QUESTIONS: readonly string[] = [
  "Think of a time you were under real pressure. What did you do, and why that?",
  "What do people most often come to you for?",
  "Tell me about something that frustrates you more than it seems to frustrate others.",
  "Describe a decision you're proud of. What made it the right call for you?",
  "When a group you're part of is stuck, what role do you usually end up playing?",
  "What's something you've had to grow out of, and what did that look like?",
];

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
    pendingQuestion: OPENING_QUESTION,
    result: null,
  };
}

/**
 * Decide what to show the participant next, derived purely from current state.
 * This is what makes the flow resumable: a reload re-derives the right view
 * from the persisted Session rather than trusting anything held on the client.
 */
export function nextTurn(state: InterviewState): NextTurn {
  if (state.status === "complete" || state.pendingQuestion === null) {
    return { kind: "result" };
  }
  return {
    kind: "question",
    prompt: state.pendingQuestion,
    questionNumber: state.turns.length + 1,
  };
}

/** What the scorer produced for one answer. */
export interface ScoredAnswer {
  deltas: readonly MarkerDelta[];
  nextQuestion: string | null;
}

/**
 * Fold a scored answer into the state, returning a new state (no mutation). The
 * answer is recorded against the question that was actually pending, its deltas
 * are applied, and the Stop Condition decides between completing with a result
 * and queueing the next question. Answering a complete Session is a no-op.
 */
export function applyTurn(
  state: InterviewState,
  answer: string,
  scored: ScoredAnswer,
): InterviewState {
  if (state.status === "complete" || state.pendingQuestion === null) {
    return state;
  }

  const turnIndex = state.turns.length;
  const turn: InterviewTurn = { question: state.pendingQuestion, answer };
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
      pendingQuestion: null,
      result: verdict.result,
    };
  }

  return {
    status: "in_progress",
    turns,
    profile,
    trace,
    pendingQuestion:
      scored.nextQuestion ?? FALLBACK_QUESTIONS[turnIndex % FALLBACK_QUESTIONS.length],
    result: null,
  };
}
