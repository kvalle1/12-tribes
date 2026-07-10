/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). Slice #16 adds real
 * Marker scoring: the running `profile` is now filled from cited-Marker deltas
 * and every applied delta keeps a `trace` back to the answer and Marker id.
 */

/** A running per-tribe strength tally, keyed by tribe `slug`. */
export type StrengthProfile = Record<string, number>;

/**
 * Which field of a tribe's profile a Marker is distilled from (ADR-0010). The
 * single source of truth for this union lives here — `markers.ts` re-exports it —
 * so the scoring types and the catalog can never drift apart.
 */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

/**
 * Where a scored answer places the participant on a tribe's fall→oil arc
 * (ADR-0004). Captured on each delta for the Posture axis; the full Posture
 * roll-up into the result is a later slice (#20). `neutral` = no arc signal.
 */
export type PostureSignal = "active-shadow" | "integrated" | "neutral";

/**
 * One scored contribution the agent found in an answer, citing a catalogued
 * Marker (ADR-0003 — the agent may only score by citing Markers, never invent
 * rationale). `tribeSlug` and `type` are authoritative from the catalog, keyed
 * off `markerId`; `delta` is the (non-negative) strength contribution.
 */
export interface ScoreDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** Non-negative magnitude toward the tribe's strength (ADR-0004: additive only). */
  delta: number;
  postureSignal: PostureSignal;
}

/**
 * One applied delta, retaining the trace from the answer (`turnIndex`) through
 * the Marker to the strength change (`before`→`after`). This is what makes the
 * Interview defensible: a participant can see which answer mapped to which
 * Marker produced which delta.
 */
export interface ScoreTraceEntry {
  turnIndex: number;
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  delta: number;
  before: number;
  after: number;
  postureSignal: PostureSignal;
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
  /** Running strength profile, filled from cited-Marker deltas (#16). */
  profile: StrengthProfile;
  /** Per-delta score trace, oldest first — the answer→Marker→delta record (#16). */
  trace: ScoreTraceEntry[];
}

/** The stub result shown once the flow completes (Primary/Contenders derivation is #17). */
export interface StubResult {
  headline: string;
  note: string;
}

/** What the participant should be shown next: another question, or the result. */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number; totalQuestions: number }
  | { kind: "result" };
