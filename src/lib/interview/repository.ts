import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { appendAnswer, emptyProfile, stubResult } from "./flow";
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
  return { status: row.status, turns: row.turns, profile: row.profile };
}

/**
 * Record a participant's free-text answer against a Session and persist the
 * resulting state. Returns the updated row. If the Session is already complete
 * the answer is ignored (the pure flow treats it as a no-op) and the existing
 * row is returned unchanged.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const next = appendAnswer(toState(row), answer);
  const result = next.status === "complete" ? stubResult(next) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
