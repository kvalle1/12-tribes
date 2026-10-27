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
 * Every trace entry carries one; the scoring engine aggregates them per tribe
 * into a `TribePosture` (slice 6). `neutral` is the default when an answer is
 * not posture-bearing.
 */
export type PostureSignal = "active-shadow" | "neutral" | "integrated";

export const POSTURE_SIGNALS: readonly PostureSignal[] = [
  "active-shadow",
  "neutral",
  "integrated",
] as const;

/**
 * The aggregated reading of a tribe's Posture: mostly from the shadow side,
 * mostly from the oil side, a mix of both, or no posture-bearing evidence yet.
 */
export type PostureReading = "active-shadow" | "mixed" | "integrated" | "unread";

/**
 * One tribe's Posture (ADR-0004), orthogonal to its strength. `integrated` and
 * `activeShadow` add up the strength deltas whose signal leaned each way
 * (neutral evidence counts toward neither). `arc` places the tribe on its
 * fall→oil arc from -1 (active-shadow) to +1 (integrated), and is null when
 * nothing posture-bearing has been said.
 */
export interface TribePosture {
  integrated: number;
  activeShadow: number;
  arc: number | null;
  reading: PostureReading;
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
  /**
   * Set when the scoring engine re-attributed this evidence: a matured
   * fall-line is recorded against the tribe's oil Marker (ADR-0004), and this
   * keeps the fall-line Marker the agent originally cited.
   */
  routedFrom?: string;
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
 * tribes (ADR-0002), `confidence` is 0–1, and `posture` places each tribe on
 * its fall→oil arc (ADR-0004).
 */
export interface InterviewResult {
  primary: string[];
  contenders: string[];
  coPrimary: boolean;
  confidence: number;
  percentages: Record<string, number>;
  /**
   * Per-tribe Posture for all 12 tribes (slice 6). Optional because results
   * persisted before slice 6 lack it; readers derive it from the trace then.
   */
  posture?: Record<string, TribePosture>;
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
