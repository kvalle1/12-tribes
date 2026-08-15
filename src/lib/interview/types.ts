/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). The `MarkerType` import
 * below is **type-only** — it is erased at compile time, so pulling it from the
 * `server-only` catalog module never drags that module into a client bundle.
 */
import type { MarkerType } from "./markers";

/** A running per-tribe strength tally, keyed by tribe `slug`. */
export type StrengthProfile = Record<string, number>;

/**
 * Where a scored Marker sits on the fall→oil redemption arc for this participant
 * (ADR-0004). Orthogonal to strength: a matured fall-line reads as `integrated`,
 * never as absence of the tribe.
 */
export type PostureSignal = "active-shadow" | "aware" | "integrated";

export const POSTURE_SIGNALS = [
  "active-shadow",
  "aware",
  "integrated",
] as const satisfies readonly PostureSignal[];

/**
 * One per-Marker score contribution the agent returns for a single answer. The
 * agent may only cite catalogued Markers (ADR-0003); `markerId` is validated
 * against the Marker Catalog server-side before the delta is ever applied, so an
 * ad-hoc or mis-attributed citation is dropped rather than scored.
 */
export interface MarkerDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** The agent's proposed strength contribution. Bounded to the Marker's weight and never negative when applied. */
  delta: number;
  postureSignal: PostureSignal;
}

/**
 * The durable audit record for one applied delta (ADR-0003 traceability): which
 * answer (`turnIndex` into `turns`), via which Marker, produced which strength
 * change and posture reading. Every applied delta keeps one.
 */
export interface ScoreTrace {
  /** Index into `turns` of the answer that produced this delta. */
  turnIndex: number;
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  delta: number;
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
  /** Running per-tribe Strength Profile, grown by applying Marker deltas. */
  profile: StrengthProfile;
  /** Audit trail: every applied delta traced back to its answer and Marker. */
  traces: ScoreTrace[];
  /** The question currently awaiting an answer (the fixed opener, then LLM-produced). `null` once complete. */
  pendingQuestion: string | null;
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
