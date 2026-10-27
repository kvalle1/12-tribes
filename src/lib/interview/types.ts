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
 * Slice 3 carries the signal the agent returns through to the trace but does not
 * yet aggregate a Posture axis — that is slice 6. `neutral` is the default when
 * an answer is not posture-bearing.
 */
export type PostureSignal = "active-shadow" | "neutral" | "integrated";

export const POSTURE_SIGNALS: readonly PostureSignal[] = [
  "active-shadow",
  "neutral",
  "integrated",
] as const;

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
 * Which phase of the Funnel (ADR-0005) a turn belongs to. `calibration` is the
 * fixed broad opening; `discrimination` is the information-gain phase that
 * follows it.
 */
export type FunnelPhase = "calibration" | "discrimination";

/**
 * A forced-choice Dilemma deployed during Discrimination to break a stubborn tie
 * between two Contenders (ADR-0008). Its two situations carry **no tribe labels**
 * — the scored signal is the trade-off plus the participant's free-text "why",
 * never the bare option picked, so mapping an option straight to a tribe is
 * exactly the failure mode this type must avoid. `pair` is the Contender pair the
 * Dilemma targets; it is internal planning metadata and never shown.
 */
export interface Dilemma {
  id: string;
  pair: [string, string];
  /** The neutrally-phrased framing shown above the two options. */
  prompt: string;
  /** Concrete situation A, tribe-unlabelled. */
  optionA: string;
  /** Concrete situation B, tribe-unlabelled. */
  optionB: string;
}

/** Which of a Dilemma's two options the participant chose. */
export type DilemmaChoice = "A" | "B";

/**
 * The Dilemma context retained on a completed Turn: which situations were posed
 * and which one the participant chose. Kept so the trade-off is auditable, but it
 * is never mapped directly to a tribe score (ADR-0008) — scoring runs on the
 * free-text "why" plus the trade-off, held in the Turn's `answer`.
 */
export interface DilemmaRecord {
  id: string;
  pair: [string, string];
  optionA: string;
  optionB: string;
  choice: DilemmaChoice;
}

/** One completed exchange: the question the participant was shown and their free-text answer. */
export interface InterviewTurn {
  question: string;
  answer: string;
  /** Present when this Turn was a Dilemma rather than a free-text question. */
  dilemma?: DilemmaRecord;
}

/**
 * What the participant is shown next and must answer: a free-text question
 * (carrying its Funnel phase) or a Dilemma. Persisted each Turn so a refresh
 * resumes at the exact pending turn (ADR-0011).
 */
export type PendingTurn =
  | { kind: "question"; phase: FunnelPhase; prompt: string }
  | { kind: "dilemma"; phase: "discrimination"; dilemma: Dilemma };

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
  /** The turn awaiting an answer; null once the Interview is complete. */
  pendingTurn: PendingTurn | null;
  /** Set once the Stop Condition is met. */
  result: InterviewResult | null;
}

/** What the participant should be shown next: another question, a Dilemma, or the result. */
export type NextTurn =
  | { kind: "question"; phase: FunnelPhase; prompt: string; questionNumber: number }
  | { kind: "dilemma"; dilemma: Dilemma; questionNumber: number }
  | { kind: "result" };
