import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreTurn } from "./agent";
import {
  appendTurn,
  emptyProfile,
  finalizeScoredTurn,
  lastTurnIndex,
  OPENING_QUESTION,
} from "./flow";
import { applyDeltas, deriveInterviewResult } from "./scoring";
import type { InterviewState } from "./types";

/**
 * Server-only persistence + orchestration for Interview Sessions (ADR-0009
 * trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state and the Marker Catalog can never leak to or be mutated
 * by the client. State-transition rules live in the pure `flow` module and the
 * scoring math in the pure `scoring` module; this layer loads, drives one Turn
 * (agent → score → fold), and saves.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Create a fresh in-progress Session and return its row (incl. generated id). */
export async function createInterviewSession(
  userId?: string | null,
): Promise<InterviewSessionRow> {
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: "in_progress",
      profile: emptyProfile(),
      turns: [],
      turnCount: 0,
      trace: [],
      currentQuestion: OPENING_QUESTION,
    })
    .returning();
  return row;
}

/** Load a Session by id, or null if it does not exist. */
export async function getInterviewSession(
  id: string,
): Promise<InterviewSessionRow | null> {
  const [row] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, id))
    .limit(1);
  return row ?? null;
}

/** Project a persisted row onto the pure flow state. */
function toState(row: InterviewSessionRow): InterviewState {
  return {
    status: row.status,
    turns: row.turns,
    profile: row.profile,
    trace: row.trace,
    currentQuestion: row.currentQuestion,
  };
}

/**
 * Record a participant's free-text answer, score it against the Marker Catalog,
 * fold the result into the Session, and persist. Returns the updated row.
 *
 * The answer is recorded, the profile is updated by a single tool-use call
 * (`scoreTurn`), and the resulting deltas are applied by the pure Scoring engine
 * with a full trace. Crucially, the model call happens **before** any write:
 * if it throws, nothing is persisted, so the Session stays resumable at the same
 * question rather than losing the answer or advancing with an unscored Turn.
 *
 * A no-op (returns the row unchanged) when the Session is already complete or
 * has no pending question.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  const appended = appendTurn(state, answer);
  if (appended === state) {
    // Already complete / no pending question — nothing to score or persist.
    return row;
  }

  // Score the just-appended answer against the catalog (may throw — see above).
  const { deltas, nextQuestion } = await scoreTurn(appended.turns);
  const { profile, trace } = applyDeltas(
    appended.profile,
    lastTurnIndex(appended),
    deltas,
  );
  const next = finalizeScoredTurn(appended, {
    profile,
    newTrace: trace,
    nextQuestion,
  });

  const result = next.status === "complete" ? deriveInterviewResult(next.profile) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      trace: next.trace,
      currentQuestion: next.currentQuestion,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
