/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). As of slice 3 (issue
 * #16) the Strength Profile is filled by real Marker scoring and questions are
 * produced by the agent, so the state carries the current question and each Turn
 * carries its score trace. The final Primary/Contenders result is still stubbed
 * (issue #17).
 */

import type { AppliedDelta } from "./score";

/** A running per-tribe strength tally, keyed by tribe `slug`. */
export type StrengthProfile = Record<string, number>;

/**
 * One completed exchange: the question the participant was shown, their
 * free-text answer, and the score trace — which Markers the answer resolved to
 * and what each contributed (the basis for the result's transparency, issue #21).
 */
export interface InterviewTurn {
  question: string;
  answer: string;
  /** Applied cited-Marker deltas for this answer. Absent on pre-slice-3 rows. */
  trace?: AppliedDelta[];
}

/** Server-authoritative Session state the pure flow logic operates on. */
export interface InterviewState {
  status: "in_progress" | "complete";
  /** History of completed Turns, oldest first. */
  turns: InterviewTurn[];
  /** Running strength profile, updated each Turn from cited-Marker deltas. */
  profile: StrengthProfile;
  /** The question currently being asked (agent-produced after the opener). */
  currentQuestion: string;
}

/** The stub result shown once the (stubbed) flow completes. */
export interface StubResult {
  headline: string;
  note: string;
}

/** What the participant should be shown next: another question, or the result. */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number; totalQuestions: number }
  | { kind: "result" };
