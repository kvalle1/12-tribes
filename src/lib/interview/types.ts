/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client) for the walking-skeleton
 * slice. Real scoring (Marker deltas, Posture, confidence) arrives in later
 * slices; here the `profile` is a placeholder and the result is a stub.
 */

/** A running per-tribe strength tally, keyed by tribe `slug`. Placeholder in this slice. */
export type StrengthProfile = Record<string, number>;

/** One completed exchange: the question the participant was shown and their free-text answer. */
export interface InterviewTurn {
  question: string;
  answer: string;
}

/** Server-authoritative Session state the pure flow logic operates on. */
export interface InterviewState {
  status: "in_progress" | "complete";
  /** History of completed Turns, oldest first. */
  turns: InterviewTurn[];
  /** Running strength profile (placeholder this slice). */
  profile: StrengthProfile;
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
