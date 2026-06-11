/**
 * Interview domain types.
 *
 * These are the shapes of the **Session** — the server-authoritative state of one
 * Interview run (see CONTEXT.md and ADR-0009 / ADR-0011). This module is
 * deliberately free of runtime imports so both the pure flow logic and the
 * Drizzle schema can depend on it without pulling in the data layer.
 *
 * In this walking skeleton (issue #14) the running Strength Profile is a
 * placeholder; later slices fill it from real Marker-based scoring.
 */

export type SessionStatus = "in_progress" | "complete";

/** ADR-0002: a Strength Profile is a score per tribe `slug`. Zeroed for now. */
export type StrengthProfile = Record<string, number>;

/** One question-and-answer exchange — the unit of the Interview loop (a Turn). */
export interface Turn {
  /** Zero-based position in the Session's Turn history. */
  index: number;
  /** The question shown to the participant. */
  question: string;
  /** The participant's free-text answer, or `null` while the Turn is pending. */
  answer: string | null;
}

/**
 * The full server-side Session. Holds scoring state (`profile`) and the answer
 * history — it is persisted every Turn and is **never** shipped to or mutated by
 * the client. Use {@link ClientView} for anything that crosses to the browser.
 */
export interface Session {
  id: string;
  /** Optional link to the participant's Account; absent in the skeleton flow. */
  userId: string | null;
  status: SessionStatus;
  turns: Turn[];
  /** Number of answered Turns. */
  turnCount: number;
  /** Running Strength Profile — server-only scoring state. */
  profile: StrengthProfile;
}

/**
 * The safe projection of a Session that may cross to the client. It carries only
 * what the UI needs to render — never the Strength Profile or prior answers — so
 * the instrument stays un-gameable (ADR-0009).
 */
export interface ClientView {
  sessionId: string;
  status: SessionStatus;
  /** The pending Turn to answer, or `null` once the Interview is complete. */
  currentTurn: { index: number; question: string } | null;
  turnCount: number;
}
