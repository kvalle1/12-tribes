/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). Real scoring arrives in
 * this slice (#16): a free-text answer is scored against the Marker Catalog and
 * folded into a running Strength Profile with a citable trace. The Posture axis,
 * Confidence/Stop evaluator, and Funnel are later slices (#17, #19, #20).
 */

import type { MarkerType } from "./markers";

/**
 * A running per-tribe strength tally, keyed by tribe `slug`. Scores are
 * **independent** (ADR-0002) — one tribe scoring high does not push another
 * down. Display normalization to percentages is cosmetic and computed
 * separately (`toDisplayShares`).
 */
export type StrengthProfile = Record<string, number>;

/**
 * One Marker delta the agent cited when scoring an answer (the structured
 * tool-use payload, ADR-0003). `markerId` must resolve against the Marker
 * Catalog; the agent may not invent rationale. `delta` is the agent's read of
 * how strongly the answer evidenced this Marker, in [0, 1]; the strength
 * contribution is derived server-side from the catalogued Marker weight.
 */
export interface ScoredDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** How strongly the answer evidenced this Marker, 0–1 (agent's read). */
  delta: number;
  /**
   * Where on the fall→oil arc this evidence sits, -1 (active-shadow) … +1
   * (integrated). Carried through to the trace this slice; the Posture axis is
   * aggregated end-to-end in slice #20 (ADR-0004).
   */
  postureSignal: number;
}

/**
 * A Marker delta after the Scoring engine has applied it — the citable trace
 * unit. Carries the catalogued Marker `type`/`weight` (canonical, not the
 * agent's claim) and the resulting `contribution` to the tribe's strength, so a
 * participant or skeptic can see *which answer* mapped to *which Marker*
 * produced *which delta* (ADR-0003).
 */
export interface AppliedDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** Catalogued Marker weight (bounds the contribution). */
  weight: number;
  /** The agent's clamped [0, 1] evidence strength. */
  delta: number;
  /** `weight × delta` — what was actually added to the tribe's strength. */
  contribution: number;
  postureSignal: number;
}

/**
 * One completed exchange: the question shown, the participant's free-text
 * answer, and the Marker deltas that answer produced. The `deltas` are the
 * per-answer trace (ADR-0003) — every applied delta points back to this
 * answer's Marker ids.
 */
export interface InterviewTurn {
  question: string;
  answer: string;
  deltas: AppliedDelta[];
}

/** Server-authoritative Session state the pure flow logic operates on. */
export interface InterviewState {
  status: "in_progress" | "complete";
  /** History of completed Turns, oldest first. */
  turns: InterviewTurn[];
  /** Running strength profile — independent per-tribe scores. */
  profile: StrengthProfile;
  /**
   * The next question to ask, produced by the agent when it scored the last
   * answer. `null` before any answer has been scored (the fixed opener is used
   * for the first Turn).
   */
  nextQuestion: string | null;
}

/**
 * The result shown once the flow completes. Real this slice: the ranked,
 * display-normalized Strength Profile plus the score trace. Primary is simply
 * the top-scoring tribe here; the Confidence/Stop evaluator that derives
 * Primary + Contenders / Co-Primaries is slice #17 (ADR-0006).
 */
export interface InterviewResult {
  /** Every tribe's display share (percent, summing to ~100), ranked desc. */
  shares: TribeShare[];
  /** The top-scoring tribe's slug, or null if nothing scored. */
  primarySlug: string | null;
}

/** A tribe's normalized display share for the result view. */
export interface TribeShare {
  slug: string;
  name: string;
  /** Percent of total scored strength (0–100). */
  percent: number;
  /** Raw independent score, for reference. */
  score: number;
}

/** What the participant should be shown next: another question, or the result. */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number; totalQuestions: number }
  | { kind: "result" };
