/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). Real scoring lands in
 * slice #16: `profile` accumulates cited Marker deltas and `trace` records why.
 *
 * `MarkerType` is imported type-only, so the `server-only` Marker Catalog module
 * it lives in is never pulled into a client (or DB) bundle — the import is
 * erased at compile time.
 */
import type { MarkerType } from "./markers";

/** A running per-tribe strength tally, keyed by tribe `slug`. */
export type StrengthProfile = Record<string, number>;

/**
 * One cited Marker delta the Interview agent returns for a single answer (#16).
 * Scoring is constrained to catalogued Markers (ADR-0003) — the scoring engine
 * drops any delta whose `markerId` doesn't resolve or whose `tribeSlug` disagrees
 * with the cited Marker's own tribe.
 */
export interface MarkerDelta {
  /** Exact id of a Marker in the catalog — the only thing that may score. */
  markerId: string;
  /** The tribe the marker scores toward; must match the marker's own tribe. */
  tribeSlug: string;
  type: MarkerType;
  /** How strongly the answer matches the Marker's signal (0–1). */
  delta: number;
  /** Where on the fall→oil arc this evidence sits (Posture; consumed in slice #20). */
  postureSignal?: string;
}

/**
 * One line of the score trace: an answer, the Marker it fired, and what that
 * added to the tribe's strength (#16). Every applied delta keeps a trace entry
 * so the result can later explain itself (slice #21).
 */
export interface ScoreTraceEntry {
  /** The free-text answer this delta was read from. */
  answer: string;
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** The agent's cited delta, clamped to [0,1] (shadow/fall-line never subtract, ADR-0004). */
  delta: number;
  /** delta × the Marker's weight — the amount actually added to the tribe's strength. */
  contribution: number;
}

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
  /** Running strength profile — cited Marker contributions per tribe (#16). */
  profile: StrengthProfile;
  /** Score trace, oldest first; empty until an answer has been scored (#16). */
  trace: ScoreTraceEntry[];
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
