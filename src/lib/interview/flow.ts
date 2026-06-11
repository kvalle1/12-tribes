import { tribes } from "@/lib/tribes";
import type { ClientView, Session, StrengthProfile, Turn } from "./types";

/**
 * Pure Interview flow logic — no I/O, no database. The server-authoritative loop
 * (the route/action layer) drives a Session through these functions and persists
 * the result each Turn; keeping the transitions pure makes them unit-testable
 * without a live datastore.
 *
 * Walking skeleton (issue #14): the Interview asks a single hardcoded question
 * and then completes. There is no LLM and no real scoring yet — later slices add
 * the Marker Catalog, dynamic Turn selection, and the Stop Condition.
 */

/** The single broad opening question. Later slices replace this with a Funnel. */
export const FIRST_QUESTION =
  "Tell me about a recent moment when you felt most like yourself — what was happening, and what were you doing?";

/** A fresh Strength Profile with every tribe at zero (ADR-0002 output shape). */
export function emptyProfile(): StrengthProfile {
  return Object.fromEntries(tribes.map((tribe) => [tribe.slug, 0]));
}

/** Open a new in-progress Session with its first (pending) Turn. */
export function startSession(id: string, userId: string | null = null): Session {
  return {
    id,
    userId,
    status: "in_progress",
    turns: [{ index: 0, question: FIRST_QUESTION, answer: null }],
    turnCount: 0,
    profile: emptyProfile(),
  };
}

/** The pending (unanswered) Turn, or `null` when the Session is complete. */
export function currentTurn(session: Session): Turn | null {
  return session.turns.find((turn) => turn.answer === null) ?? null;
}

/**
 * Record the participant's answer to the pending Turn and advance the Session.
 *
 * Returns a new Session (the input is never mutated). When the Session is already
 * complete it is a no-op. In the skeleton flow the Interview stops after the
 * first answer; future slices decide here whether to ask another Turn or stop.
 */
export function recordAnswer(session: Session, answer: string): Session {
  const pending = currentTurn(session);
  if (!pending) return session;

  const trimmed = answer.trim();
  const turns = session.turns.map((turn) =>
    turn.index === pending.index ? { ...turn, answer: trimmed } : turn,
  );

  return {
    ...session,
    turns,
    turnCount: session.turnCount + 1,
    // One question in the skeleton, so any answer completes the run.
    status: "complete",
  };
}

/**
 * Project a Session down to the {@link ClientView} that may cross to the browser.
 * Strips the Strength Profile and the answer history so no scoring state ever
 * leaves the server (ADR-0009).
 */
export function toClientView(session: Session): ClientView {
  const pending = currentTurn(session);
  return {
    sessionId: session.id,
    status: session.status,
    currentTurn: pending
      ? { index: pending.index, question: pending.question }
      : null,
    turnCount: session.turnCount,
  };
}
