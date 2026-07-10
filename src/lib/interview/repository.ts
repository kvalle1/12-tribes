import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreAnswer } from "./agent";
import { appendAnswer, emptyProfile, stubResult } from "./flow";
import { applyDeltas } from "./score";
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
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: "in_progress",
      profile: emptyProfile(),
      turns: [],
      turnCount: 0,
      trace: [],
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
  };
}

/**
 * Record a participant's free-text answer against a Session, score it against
 * the Marker Catalog, and persist the resulting state. Returns the updated row.
 *
 * The single scoring Turn (ADR-0009): record the answer, ask the agent for the
 * cited-Marker deltas, fold them into the Strength Profile with the pure scoring
 * engine, and append the score trace. All of this runs server-side; the client
 * only ever submitted a string. If the Session is already complete the answer is
 * a no-op (no wasted model call) and the existing row is returned unchanged.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const prev = toState(row);
  const withAnswer = appendAnswer(prev, answer);

  // Only score when a new Turn was actually recorded (guards the complete no-op).
  let next = withAnswer;
  if (withAnswer.turns.length > prev.turns.length) {
    const turnIndex = withAnswer.turns.length - 1;
    const turn = withAnswer.turns[turnIndex];
    const { deltas } = await scoreAnswer(turn.question, turn.answer);
    const { profile, trace } = applyDeltas(withAnswer.profile, deltas, turnIndex);
    next = { ...withAnswer, profile, trace: [...withAnswer.trace, ...trace] };
  }

  const result = next.status === "complete" ? stubResult(next) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      trace: next.trace,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
