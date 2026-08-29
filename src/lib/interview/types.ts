/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). Slice 3 (#16) fills in
 * real scoring: a `profile` fed by cited Marker deltas, a `posture` tally per
 * tribe, and a `trace` linking every applied delta back to its answer.
 */

/** The four Marker types (mirrors `MarkerType` in the server-only catalog). */
export type ScoredMarkerType = "strength" | "oil" | "shadow" | "fallLine";

/** A running per-tribe strength tally, keyed by tribe `slug`. Independent per tribe (ADR-0002). */
export type StrengthProfile = Record<string, number>;

/**
 * A running per-tribe Posture tally, keyed by tribe `slug` (ADR-0004). Positive
 * leans toward *integrated* (matured, oil), negative toward *active-shadow*.
 * Orthogonal to strength: it never changes whether a tribe is present, only
 * where on the fall→oil arc the participant sits.
 */
export type PostureProfile = Record<string, number>;

/**
 * One scored contribution the agent asserts, each citing exactly one catalogued
 * Marker (ADR-0003). This is the shape carried by the LLM tool-use payload and
 * validated against the Marker Catalog before it is ever applied.
 */
export interface ScoredDelta {
  /** The cited Marker's stable id — must resolve in the catalog. */
  markerId: string;
  /** The tribe the delta scores toward — must match the cited Marker. */
  tribeSlug: string;
  /** The cited Marker's type — must match the cited Marker. */
  type: ScoredMarkerType;
  /** Bounded, non-negative strength contribution. */
  delta: number;
  /** Posture nudge in [-1, 1]: negative = active-shadow, positive = integrated. */
  postureSignal: number;
}

/**
 * One entry in the score trace (ADR-0003 traceability): which Turn's answer,
 * via which Marker, produced which delta. Persisted so a participant can see
 * *why* they scored as they did.
 */
export interface ScoreTraceEntry {
  /** Index into `turns` of the answer this delta was drawn from. */
  turnIndex: number;
  markerId: string;
  tribeSlug: string;
  type: ScoredMarkerType;
  delta: number;
  postureSignal: number;
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
  /** Running per-tribe strength profile, fed by cited Marker deltas. */
  profile: StrengthProfile;
  /** Running per-tribe Posture tally (ADR-0004). */
  posture: PostureProfile;
  /** Every applied delta, retained for the score trace. */
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
