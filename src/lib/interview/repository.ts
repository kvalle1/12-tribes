import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreAnswer, type ScoreAnswer } from "./agent";
import { applyTurn, initialState, OPENING_QUESTION } from "./flow";
import type { InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state can never leak to or be mutated by the client. All
 * decisions about state transitions live in the pure `flow` module; this layer
 * only loads, applies, and saves.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Create a fresh in-progress Session and return its row (incl. generated id). */
export async function createInterviewSession(
  userId?: string | null,
): Promise<InterviewSessionRow> {
  const state = initialState();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: state.status,
      profile: state.profile,
      turns: state.turns,
      turnCount: 0,
      trace: state.trace,
      pendingQuestion: state.pendingQuestion,
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

/**
 * Project a persisted row onto the pure flow state. Sessions created before
 * slice 4 have no `pendingQuestion`; an in-progress one of those has not been
 * answered yet (the old flow completed after one Turn), so it resumes at the
 * opening question.
 */
export function toState(row: InterviewSessionRow): InterviewState {
  const legacyPending = row.status === "in_progress" ? OPENING_QUESTION : null;
  return {
    status: row.status,
    turns: row.turns,
    profile: row.profile,
    trace: row.trace,
    pendingQuestion: row.pendingQuestion ?? legacyPending,
    result: row.status === "complete" ? row.result : null,
  };
}

/**
 * Record a participant's free-text answer against a Session, score it, and
 * persist the resulting state — one Turn of the loop (ADR-0009). Returns the
 * updated row. If the Session is already complete the answer is ignored and the
 * existing row is returned unchanged.
 *
 * The scoring call runs here on the server: the answer is scored into
 * validated, catalog-bounded Marker deltas plus a proposed next question, and
 * the pure flow folds them in and applies the Stop Condition (ADR-0006). The
 * scorer is injected (defaulting to the real agent) so this seam is
 * substitutable.
 *
 * The write is conditional on the Turn count it was computed from, so a double
 * submit (or a resubmit after a refresh) cannot record the same Turn twice: the
 * losing write changes nothing and the current row is returned instead.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
  scorer: ScoreAnswer = scoreAnswer,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  if (state.status === "complete" || state.pendingQuestion === null) return row;

  const scored = await scorer({
    question: state.pendingQuestion,
    answer,
    history: state.turns,
  });
  const next = applyTurn(state, answer, scored);

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      trace: next.trace,
      pendingQuestion: next.pendingQuestion,
      result: next.result,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.turnCount, row.turnCount),
      ),
    )
    .returning();
  return updated ?? getInterviewSession(id);
}
