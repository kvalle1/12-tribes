/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). As of slice #16 the
 * `profile` carries real Marker-scored strength and each Turn carries the
 * Marker deltas that produced it (the score trace). The multi-Turn loop
 * (#17), Posture surfacing (#20), and the score-trace view (#21) come later;
 * `postureSignal` is captured here now so those slices build on real data.
 *
 * `MarkerType` is imported as a type only (erased at build) so this shared,
 * client-safe module never pulls in the `server-only` Marker Catalog.
 */
import type { MarkerType } from "./markers";

/** A running per-tribe strength tally, keyed by tribe `slug`. Real scores as of #16. */
export type StrengthProfile = Record<string, number>;

/**
 * Where an answer places the participant on a tribe's fall→oil arc (ADR-0004).
 * Captured per scored delta so a later slice can aggregate Posture; it never
 * affects strength here.
 */
export type PostureSignal = "active-shadow" | "neutral" | "integrated";

/**
 * One Marker delta the agent assigned to an answer (ADR-0003). Every delta
 * cites a catalogued Marker `id` — the agent may not invent scoring rationale —
 * and carries the Marker's `tribeSlug`/`type` (reconciled against the catalog)
 * plus a bounded, non-negative `delta`. This is also the trace record: it lives
 * on the Turn whose answer produced it, so a score always traces back to a
 * specific answer and Marker.
 */
export interface ScoredDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** Bounded, non-negative contribution to the tribe's strength (ADR-0004: never lowers). */
  delta: number;
  postureSignal: PostureSignal;
}

/**
 * One completed exchange: the question the participant was shown, their
 * free-text answer, and the Marker deltas scored from it (the per-answer trace).
 */
export interface InterviewTurn {
  question: string;
  answer: string;
  deltas: ScoredDelta[];
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
