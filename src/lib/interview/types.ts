/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). As of the real-scoring
 * slice (#16) the `profile` is a live Strength Profile accumulated from cited
 * Marker deltas, and every applied delta keeps a trace back to the answer and
 * Marker that produced it (ADR-0002/0003).
 */

/** A running per-tribe strength tally, keyed by tribe `slug`. Independent scores. */
export type StrengthProfile = Record<string, number>;

/**
 * Which field of a tribe's profile a Marker is distilled from. Mirrors the
 * `MarkerType` in the server-only Marker Catalog (`markers.ts`), declared here
 * so the client-safe types don't reach into that server-only module.
 */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

/**
 * One scored contribution the agent assigns to an answer. Every delta must cite
 * a catalogued Marker `id` (ADR-0003); `tribeSlug`/`type` echo the cited Marker
 * for the trace, and are validated against the catalog when applied. `delta` is
 * the agent's 0–1 evidence strength; the actual strength contribution is the
 * Marker's `weight × clamp(delta, 0, 1)`, so it is always additive (ADR-0004).
 */
export interface ScoredDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** Evidence strength in 0–1; clamped and multiplied by the Marker weight. */
  delta: number;
  /** Posture signal in −1..1; carried for slice #20, not yet tallied into Posture. */
  postureSignal: number;
}

/**
 * One applied delta's trace: the answer it came from, the Marker cited, and the
 * strength contribution folded into the profile. This is what makes a score
 * inspectable — a participant can see which answer mapped to which Marker
 * produced which delta (ADR-0003; surfaced in slice #21).
 */
export interface TraceEntry {
  /** 0-based index of the Turn (into `turns`) this delta was scored from. */
  turnIndex: number;
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** The agent's raw evidence strength (pre-clamp), retained for transparency. */
  delta: number;
  /** The Marker's catalog weight used for the contribution. */
  weight: number;
  /** weight × clamp(delta, 0, 1) — always ≥ 0, folded into the profile. */
  contribution: number;
}

/** One completed exchange: the question shown, the free-text answer, and its scored deltas. */
export interface InterviewTurn {
  question: string;
  answer: string;
  /** The cited deltas scored from this answer (may be empty if nothing fired). */
  deltas: ScoredDelta[];
}

/** A tribe's line in the ranked result: its independent score and display share. */
export interface RankedTribe {
  slug: string;
  name: string;
  /** Raw accumulated strength — independent, not a share of a whole. */
  score: number;
  /** Normalized display percentage (0–100), cosmetic only (ADR-0002). */
  share: number;
}

/**
 * The interview result: the full 12-tribe Strength Profile ranked by score.
 * Primary/Contenders and the Stop Condition arrive in slice #17; this slice
 * reports the ranked profile a fixed number of Turns produced.
 */
export interface InterviewResult {
  ranking: RankedTribe[];
}

/** Server-authoritative Session state the pure flow logic operates on. */
export interface InterviewState {
  status: "in_progress" | "complete";
  /** History of completed Turns, oldest first. */
  turns: InterviewTurn[];
  /** Running Strength Profile, accumulated from cited Marker deltas. */
  profile: StrengthProfile;
  /** Per-delta score trace, oldest first. */
  trace: TraceEntry[];
  /** The question currently being shown; `null` once the Session is complete. */
  currentQuestion: string | null;
}

/** What the participant should be shown next: another question, or the result. */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number; totalQuestions: number }
  | { kind: "result" };
