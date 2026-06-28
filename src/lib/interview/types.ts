/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). As of slice #16 the
 * `profile` holds the real running Strength Profile built from cited Markers;
 * the multi-Turn loop, confidence/stop, and Posture surfacing arrive later.
 */

/** A running per-tribe strength tally, keyed by tribe `slug`. */
export type StrengthProfile = Record<string, number>;

/**
 * Which field of a tribe's profile a Marker is distilled from. Mirrors the
 * `MarkerType` in the server-only `markers` module, duplicated here so these
 * client-safe types never import the (server-only) catalog.
 */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

/**
 * Where on a tribe's fall→oil arc an answer points. Captured per scored Marker
 * for the Posture axis (ADR-0004); accumulated and surfaced in a later slice.
 */
export type PostureSignal = "active-shadow" | "neutral" | "integrated";

/**
 * One scored Marker the agent cited for an answer (ADR-0003). The agent may only
 * score by citing a catalogued Marker `id`; `tribeSlug`/`type`/`weight` are
 * resolved authoritatively from the catalog when applied, so a payload that
 * disagrees with the catalog (or cites an unknown id) is corrected or dropped.
 */
export interface ScoreDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** The agent's magnitude for this signal; clamped to the Marker's weight. */
  delta: number;
  postureSignal: PostureSignal;
}

/**
 * One applied contribution, retained so a participant can see *why* a tribe
 * scored as it did (ADR-0003): which answer (by Turn index) mapped to which
 * Marker produced which strength contribution. The score-trace UI is a later
 * slice; this is the data it will render.
 */
export interface ScoreTraceEntry {
  /** Index into `turns` of the answer this contribution came from. */
  turnIndex: number;
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  postureSignal: PostureSignal;
  /** The contribution actually added to strength (clamped, never negative). */
  applied: number;
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
  /** Running Strength Profile, built from cited Markers (all 12 tribes). */
  profile: StrengthProfile;
  /** The score trace — every applied Marker contribution, oldest first. */
  trace: ScoreTraceEntry[];
  /**
   * The LLM-produced question awaiting an answer, or null when none is pending
   * (e.g. once the Session is complete). Persisted so a refresh resumes on the
   * same question rather than generating a new one (ADR-0011).
   */
  pendingQuestion: string | null;
}

/**
 * The Interview result. In this slice it is the normalized Strength Profile (a
 * 0–100 share per tribe, summing to ~100 for display — ADR-0002) plus the
 * Primary tribe slug. The dynamic Contender set, Co-Primaries, and Posture
 * arrive in later slices.
 */
export interface InterviewResult {
  primarySlug: string;
  /** Per-tribe display percentage, keyed by slug. */
  normalized: StrengthProfile;
}

/** What the participant should be shown next: another question, or the result. */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number }
  | { kind: "result" };
