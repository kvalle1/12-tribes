/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). Slice 3 (issue #16)
 * replaces the walking-skeleton's placeholder `profile` with a real Strength
 * Profile accumulated from Marker deltas, and records a score trace so every
 * delta can be traced back to the answer and Marker that produced it.
 *
 * These are plain data shapes with no runtime behaviour, so they stay in this
 * client-safe module even though scoring itself (`scoring.ts`) and the Marker
 * Catalog (`markers.ts`) are server-only.
 */

/**
 * Which field of a tribe's profile a Marker is distilled from. The canonical
 * definition lives here (the client-safe base) so `markers.ts` and `scoring.ts`
 * share one source of truth; `markers.ts` re-exports it for existing callers.
 */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

/**
 * Where an answer places the participant on a tribe's fall→oil arc (ADR-0004).
 * One answer's signal; the trace carries these through and slice 6 aggregates
 * them per tribe into a {@link TribePosture}. `neutral` is the default when an
 * answer is not posture-bearing.
 */
export type PostureSignal = "active-shadow" | "neutral" | "integrated";

export const POSTURE_SIGNALS: readonly PostureSignal[] = [
  "active-shadow",
  "neutral",
  "integrated",
] as const;

/**
 * Where a tribe sits on its fall→oil arc once every posture-bearing answer is
 * aggregated (ADR-0004) — the per-tribe counterpart to a single answer's
 * {@link PostureSignal}. `active-shadow` and `integrated` are the two poles;
 * `mixed` is posture-bearing evidence that pulls both ways; `neutral` means no
 * posture-bearing evidence landed on the tribe at all (distinct from `mixed`).
 */
export type ArcPosition = "active-shadow" | "mixed" | "integrated" | "neutral";

export const ARC_POSITIONS: readonly ArcPosition[] = [
  "active-shadow",
  "mixed",
  "integrated",
  "neutral",
] as const;

/**
 * A tribe's accumulated Posture, derived purely from the score trace (ADR-0004).
 * `integrated` and `activeShadow` are the delta-weighted evidence on each pole;
 * `lean` is their normalized difference in [-1, 1] (0 when no posture-bearing
 * evidence), and `arc` is the labelled position derived from it. Posture rides
 * *alongside* strength and never changes it.
 */
export interface TribePosture {
  integrated: number;
  activeShadow: number;
  lean: number;
  arc: ArcPosition;
}

/** A running per-tribe strength tally, keyed by tribe `slug`. */
export type StrengthProfile = Record<string, number>;

/**
 * One validated scoring contribution the agent assigned to an answer, citing a
 * single catalogued Marker (ADR-0003: no ad-hoc rationale). `tribeSlug` and
 * `type` are authoritative — reconciled against the Marker Catalog from
 * `markerId`, never trusted from the model — and `delta` is bounded by the
 * cited Marker's weight.
 */
export interface MarkerDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  delta: number;
  postureSignal: PostureSignal;
}

/**
 * One applied delta, retained so the result can show *which answer* mapped to
 * *which Marker* produced *which delta* (ADR-0003 traceability). The answer is
 * referenced by its Turn index rather than copied, so the trace never
 * duplicates (or pre-commits the privacy handling of) the raw answer text.
 */
export interface ScoreTraceEntry {
  turnIndex: number;
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  delta: number;
  postureSignal: PostureSignal;
}

/**
 * A forced-choice tie-breaker (ADR-0008): two concrete situations with **no
 * tribe labels**. The scored signal is the trade-off the participant makes plus
 * their free-text "why" — never the bare option picked — so nothing here maps
 * an option to a tribe.
 */
export interface Dilemma {
  situationA: string;
  situationB: string;
}

/** Which of a Dilemma's two situations the participant chose. */
export type DilemmaChoice = "A" | "B";

/**
 * One completed exchange: the prompt the participant was shown and their
 * free-text answer. A Dilemma Turn also carries the two situations and the
 * option chosen; `answer` is then the participant's reasoning.
 */
export interface InterviewTurn {
  question: string;
  answer: string;
  dilemma?: Dilemma;
  choice?: DilemmaChoice;
}

/**
 * The reported outcome of an Interview (ADR-0006). `primary` is a *set*: one
 * tribe normally, or honest Co-Primaries when the top tribes are inseparable at
 * the Turn cap. `contenders` is the Primary plus every tribe within a margin of
 * it, ordered strongest first. `percentages` are the display shares for all 12
 * tribes (ADR-0002) and `confidence` is 0–1.
 */
export interface InterviewResult {
  primary: string[];
  contenders: string[];
  coPrimary: boolean;
  confidence: number;
  percentages: Record<string, number>;
}

/** Server-authoritative Session state the pure flow logic operates on. */
export interface InterviewState {
  status: "in_progress" | "complete";
  /** History of completed Turns, oldest first. */
  turns: InterviewTurn[];
  /** Running strength profile, accumulated from Marker deltas (slice 3). */
  profile: StrengthProfile;
  /** Every applied delta, oldest first, for the score trace. */
  trace: ScoreTraceEntry[];
  /** The question awaiting an answer; null once the Interview is complete. */
  pendingQuestion: string | null;
  /** Set when the pending Turn is a Dilemma rather than a free-text question. */
  pendingDilemma: Dilemma | null;
  /** Set once the Stop Condition is met. */
  result: InterviewResult | null;
}

/** What the participant should be shown next: a question, a Dilemma, or the result. */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number }
  | { kind: "dilemma"; prompt: string; dilemma: Dilemma; questionNumber: number }
  | { kind: "result" };
