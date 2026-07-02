/**
 * Interview domain types — pure, server-and-client safe (no DB, no LLM).
 *
 * These describe the server-authoritative Interview Session shape (ADR-0009:
 * scoring state lives on the server, never the client). Slice 3 (issue #16)
 * makes the `profile` real: it accumulates marker-cited strength and keeps a
 * score trace. The Posture axis, Confidence/Stop loop, and Funnel arrive in
 * later slices (#17/#19/#20) and build on these shapes without changing them.
 */

/** Which field of a tribe's profile a Marker is distilled from (mirrors `markers.ts`). */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

/**
 * Where an answer places the participant on a tribe's fall→oil arc (ADR-0004).
 * Captured on every scored delta now so the score trace is forward-compatible;
 * the full Posture axis is aggregated in slice 6 (#20).
 */
export type PostureSignal = "active-shadow" | "integrated" | "neutral";

/**
 * One scoring signal the agent emits for an answer, citing a catalogued Marker
 * (ADR-0003: the agent may only score by citing Markers). The scoring engine
 * trusts the catalog over the agent for `tribeSlug`/`type`/weight — these fields
 * carry the agent's assertion for the trace, not the authoritative values.
 */
export interface MarkerDelta {
  /** The catalogued Marker id being cited. */
  markerId: string;
  /** The tribe the agent believes it scored (validated against the catalog). */
  tribeSlug: string;
  type: MarkerType;
  /** Resonance intensity in [0, 1]; multiplied by the Marker's weight. */
  delta: number;
  postureSignal: PostureSignal;
}

/**
 * A resolved delta after the engine has looked up the cited Marker. The
 * `tribeSlug`/`type`/`weight` here are the catalogued values; `contribution` is
 * the amount added to the tribe's strength (always ≥ 0 — ADR-0004: shadow and
 * fall-line evidence is additive and never lowers strength).
 */
export interface AppliedDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** The Marker's catalogued weight. */
  weight: number;
  /** The agent's resonance intensity, clamped to [0, 1]. */
  intensity: number;
  /** `intensity × weight`, added to the tribe's running strength. Always ≥ 0. */
  contribution: number;
  postureSignal: PostureSignal;
}

/** One completed exchange: the question shown, the answer, and what it scored. */
export interface InterviewTurn {
  question: string;
  answer: string;
}

/**
 * One entry in the score trace — the answer that produced it and the Markers it
 * fired (ADR-0003: every delta is traceable to an answer and a Marker id). This
 * is what makes the Interview defensible and backs the slice 7 trace view.
 */
export interface TraceEntry {
  question: string;
  answer: string;
  applied: AppliedDelta[];
}

/** A running per-tribe strength tally, keyed by tribe `slug`. Independent scores. */
export type StrengthProfile = Record<string, number>;

/** Server-authoritative Session state the pure flow logic operates on. */
export interface InterviewState {
  status: "in_progress" | "complete";
  /** History of completed Turns, oldest first. */
  turns: InterviewTurn[];
  /** Running strength profile — independent per-tribe accumulated scores. */
  profile: StrengthProfile;
  /** The score trace: one entry per scored answer. */
  trace: TraceEntry[];
  /** The question currently being asked (LLM-produced after the opener). */
  pendingQuestion: string;
}

/** The result shown once the flow completes. */
export interface InterviewResult {
  headline: string;
  note: string;
}

/** What the participant should be shown next: another question, or the result. */
export type NextTurn =
  | { kind: "question"; prompt: string; questionNumber: number; totalQuestions: number }
  | { kind: "result" };
