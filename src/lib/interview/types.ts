/**
 * Interview domain types — pure, server-and-client safe.
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client) — the running
 * `StrengthProfile`, the `ScoredTurn` history, and the `Posture` tallies. The
 * Marker Catalog and the LLM interpreter live in their own server-only modules
 * (`markers.ts`, `interpreter.ts`); this file is deliberately dependency-free so
 * server *and* client can name these shapes without pulling scoring into the
 * client bundle.
 */

/**
 * A running per-tribe strength tally, keyed by tribe `slug`. Independent axes,
 * not a probability distribution (ADR 0002) — display normalization comes later.
 */
export type StrengthProfile = Record<string, number>;

/**
 * A running per-tribe Posture tally on the fall→oil arc (ADR 0004). Positive =
 * closer to *integrated*; negative = closer to *active-shadow*; zero =
 * unresolved. Aggregated alongside strength; surfaced in the result in slice 6.
 */
export type PostureProfile = Record<string, number>;

/** Which of the Marker Catalog's four types a single scored delta cites. */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

/**
 * A single strength delta the interpreter assigned to an answer, citing one
 * Marker (ADR 0003). Kept as data so the score trace can reconstruct which
 * answer moved which tribe via which Marker (surfaced in slice 7).
 *
 * `postureSignal` is `+1` (integrated), `-1` (active-shadow), or `0` (unresolved)
 * — orthogonal to strength (ADR 0004). A matured fall-line is expected to route
 * to the tribe's `oil` Marker with `postureSignal: +1`, not to a `fallLine`
 * Marker with strength subtraction — the scoring engine treats every delta as
 * additive on strength.
 */
export interface MarkerDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** Non-negative — enforced by `validateAndApplyDeltas`. Bounded by the Marker's own weight. */
  delta: number;
  /** Optional Posture shift. Defaults to 0 (unresolved) when omitted. */
  postureSignal?: -1 | 0 | 1;
}

/**
 * A completed Turn: the question the participant was shown, their free-text
 * answer, and the Marker-cited deltas produced by the interpreter. The
 * `scored[]` array is the durable record behind the score trace.
 */
export interface InterviewTurn {
  question: string;
  answer: string;
  /**
   * The Marker-cited deltas produced by the interpreter for this answer.
   * Empty (never `undefined`) when the interpreter returned no evidence.
   */
  scored: MarkerDelta[];
}

/**
 * Server-authoritative Session state the pure flow logic operates on.
 *
 * `currentQuestion` is the LLM-produced prompt to show for the *next* answer
 * (ADR 0005 / 0009): questions are chosen by the interpreter, not hardcoded,
 * and persisted so a refresh mid-Turn resumes on the same question rather than
 * regenerating a different one.
 */
export interface InterviewState {
  status: "in_progress" | "complete";
  /** History of completed Turns, oldest first. */
  turns: InterviewTurn[];
  /** Running strength profile — additive, never lowered (ADR 0004). */
  profile: StrengthProfile;
  /** Running Posture tallies on the fall→oil arc (ADR 0004). */
  posture: PostureProfile;
  /** The next question to show, or `null` before the first Turn is scheduled. */
  currentQuestion: string | null;
}

/**
 * Display-normalized profile — the shape the result view consumes. Per-tribe
 * shares sum to ~100 (cosmetic; ADR 0002), leaving underlying `profile` scores
 * independent and comparable to Self / 360 outputs.
 */
export interface NormalizedProfile {
  entries: Array<{
    slug: string;
    /** Raw additive score from `profile`. */
    score: number;
    /** Score as a share of the sum, in [0, 1]. Zero when every tribe is zero. */
    share: number;
  }>;
}

/** The (stub, slice-3) result shown once the flow completes. */
export interface StubResult {
  headline: string;
  note: string;
}

/**
 * What the participant should be shown next: another question, or the result.
 * `prompt` is served from persisted `currentQuestion`, so a refresh always
 * shows the same wording (ADR 0011 resume).
 */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number; totalQuestions: number }
  | { kind: "result" };
