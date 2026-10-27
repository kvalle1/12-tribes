import { tribes } from "@/lib/tribes";
import { evaluate } from "./confidence";
import { CALIBRATION_QUESTIONS, DILEMMA_PROMPT, planNextTurn } from "./funnel";
import { applyDeltas, routeMaturedFallLines } from "./scoring";
import type {
  Dilemma,
  DilemmaChoice,
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
 * Turn. The Funnel planner (ADR-0005, issue #19) then picks the kind of Turn:
 * a fixed Calibration question, a Discrimination question worded by the agent,
 * or a Dilemma when two Contenders are stubbornly tied. The model call itself
 * happens in `repository.ts`; this module only folds its output in.
 */

/** The authored opening question every Interview starts with: the first Calibration question. */
export const OPENING_QUESTION = CALIBRATION_QUESTIONS[0];

/**
 * Neutral, broad questions used only if the agent fails to propose one during
 * Discrimination, so a missing `nextQuestion` never stalls the loop. Cycled by
 * Turn number.
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
    pendingDilemma: null,
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
  if (state.pendingDilemma) {
    return {
      kind: "dilemma",
      prompt: state.pendingQuestion,
      dilemma: state.pendingDilemma,
      questionNumber: state.turns.length + 1,
    };
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
  /** A drafted Dilemma, used only if the planner calls for one. */
  dilemma?: Dilemma | null;
}

/**
 * Fold a scored answer into the state, returning a new state (no mutation). The
 * answer is recorded against the Turn that was actually pending (with the
 * Dilemma and the option chosen, for a Dilemma Turn), its deltas are applied,
 * and the Stop Condition decides between completing with a result and queueing
 * the next Turn, whose kind the Funnel planner decides. Answering a complete
 * Session, or a pending Dilemma without a choice, is a no-op.
 */
export function applyTurn(
  state: InterviewState,
  answer: string,
  scored: ScoredAnswer,
  choice?: DilemmaChoice,
): InterviewState {
  if (state.status === "complete" || state.pendingQuestion === null) {
    return state;
  }
  if (state.pendingDilemma && !choice) return state;

  const turnIndex = state.turns.length;
  const turn: InterviewTurn = state.pendingDilemma
    ? { question: state.pendingQuestion, answer, dilemma: state.pendingDilemma, choice }
    : { question: state.pendingQuestion, answer };
  const turns = [...state.turns, turn];
  // Matured fall-lines route to the tribe's oil Marker before folding in
  // (ADR-0004): the strength is unchanged, but Posture moves toward integrated
  // and the trace records the cross-confirming oil Marker.
  const deltas = routeMaturedFallLines(scored.deltas);
  const applied = applyDeltas(state.profile, deltas, turnIndex);
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
      pendingDilemma: null,
      result: verdict.result,
    };
  }

  const plan = planNextTurn({ profile, trace, turns });
  const fallback = FALLBACK_QUESTIONS[turnIndex % FALLBACK_QUESTIONS.length];
  let pendingQuestion: string;
  let pendingDilemma: Dilemma | null = null;
  if (plan.phase === "calibration") {
    pendingQuestion = plan.prompt;
  } else if (plan.kind === "dilemma" && scored.dilemma) {
    pendingQuestion = DILEMMA_PROMPT;
    pendingDilemma = scored.dilemma;
  } else {
    pendingQuestion = scored.nextQuestion ?? fallback;
  }

  return {
    status: "in_progress",
    turns,
    profile,
    trace,
    pendingQuestion,
    pendingDilemma,
    result: null,
  };
}
