/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). Slice #16 adds real
 * scoring: an answer is scored against the Marker Catalog into per-tribe
 * strength deltas, folded into the running `profile`, with a trace kept back to
 * the answer and Marker that produced it. The Posture axis and the
 * Confidence/Stop evaluator arrive in later slices; here a fixed Turn cap stands
 * in for the stop condition.
 *
 * `MarkerType` lives here (not in the server-only catalog) so the client-safe
 * scoring payload and trace types can reference it without importing a
 * server-only module.
 */

/** Which field of a tribe's profile a Marker is distilled from. */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

/**
 * Where an answer places the participant on a tribe's fall→oil arc. Captured in
 * the trace this slice; the Posture axis is fully wired end-to-end in slice #20.
 */
export type PostureSignal = "active-shadow" | "neutral" | "integrated";

/** A running per-tribe strength tally, keyed by tribe `slug`. */
export type StrengthProfile = Record<string, number>;

/** One completed exchange: the question the participant was shown and their free-text answer. */
export interface InterviewTurn {
  question: string;
  answer: string;
}

/**
 * A single scoring signal the agent emits for one answer, citing a catalogued
 * Marker (ADR-0003: the agent may only score by citing a Marker `id`; it never
 * invents rationale). `tribeSlug`/`type` echo the cited Marker so a mis-cite can
 * be detected and dropped — the catalog, not the agent, is the source of truth
 * for a Marker's tribe and weight. `delta` is the strength of the signal in the
 * answer, clamped to [0, 1] before it is scaled by the Marker's weight.
 */
export interface ScoredDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  delta: number;
  postureSignal?: PostureSignal;
}

/**
 * One applied contribution, kept so the result can explain itself (PRD story 11)
 * and so scoring is reproducible. `turnIndex` points back at the answer in
 * `InterviewState.turns` that produced it; `markerId` points at the rubric.
 */
export interface TraceEntry {
  /** Index into `InterviewState.turns` of the answer this came from. */
  turnIndex: number;
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** Points added to the tribe's strength: `weight × clamp(delta, 0, 1)`. */
  contribution: number;
  postureSignal?: PostureSignal;
}

/** A tribe's raw strength alongside its display share (a 0–100 percentage). */
export interface TribeShare {
  slug: string;
  name: string;
  /** Independent, un-normalized strength — the value scoring accumulates. */
  score: number;
  /** `score` as a percentage of all tribes' strength, for at-a-glance display. */
  share: number;
}

/** A `TribeShare` with the bar-fill fraction the result view draws. */
export interface RankedTribe extends TribeShare {
  /** 0–1 fill fraction relative to the top-scoring tribe. */
  relative: number;
}

/**
 * The derived Interview result. Slice #16 reports the full 12-tribe ranking (the
 * Strength Profile); the dynamic Contender/Co-Primary logic is layered on in
 * slice #17, so this stays deliberately small.
 */
export interface InterviewResult {
  /** All 12 tribes, highest strength first. */
  ranking: RankedTribe[];
}

/** Server-authoritative Session state the pure flow logic operates on. */
export interface InterviewState {
  status: "in_progress" | "complete";
  /** History of completed Turns, oldest first. */
  turns: InterviewTurn[];
  /** Running strength profile, accumulated from cited Marker deltas. */
  profile: StrengthProfile;
  /** The score trace: every applied contribution, back to its answer and Marker. */
  trace: TraceEntry[];
  /** The question to show next, produced by the agent; null once complete. */
  currentQuestion: string | null;
}

/** What the participant should be shown next: another question, or the result. */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number; totalQuestions: number }
  | { kind: "result" };
