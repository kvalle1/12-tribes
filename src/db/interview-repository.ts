import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { rowToSession, sessionToInsert } from "@/db/interview-mappers";
import type { InterviewSession } from "@/lib/interview/session";

/**
 * Persistence for Interview Sessions: thin Drizzle wrappers that read and write
 * the server-authoritative Session on Neon Postgres (ADR-0011). The pure
 * row↔domain mappers live in `interview-mappers.ts` so they stay unit-testable
 * without the database client.
 */

/** Insert a freshly started Session. */
export async function insertSession(session: InterviewSession): Promise<void> {
  await db.insert(interviewSessions).values(sessionToInsert(session));
}

/** Persist the mutable state of an existing Session after a Turn. */
export async function updateSession(session: InterviewSession): Promise<void> {
  await db
    .update(interviewSessions)
    .set({
      status: session.status,
      turns: session.turns,
      pendingPrompt: session.pendingPrompt,
      profile: session.profile,
      updatedAt: session.updatedAt,
    })
    .where(eq(interviewSessions.id, session.id));
}

/** The participant's in-progress Session, if any (the one to resume). */
export async function findActiveSession(
  userId: string,
): Promise<InterviewSession | null> {
  const rows = await db
    .select()
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.userId, userId),
        eq(interviewSessions.status, "in_progress"),
      ),
    )
    .orderBy(desc(interviewSessions.createdAt))
    .limit(1);

  return rows[0] ? rowToSession(rows[0]) : null;
}

/** The participant's most recently completed Session (for the result page). */
export async function findLatestCompleteSession(
  userId: string,
): Promise<InterviewSession | null> {
  const rows = await db
    .select()
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.userId, userId),
        eq(interviewSessions.status, "complete"),
      ),
    )
    .orderBy(desc(interviewSessions.updatedAt))
    .limit(1);

  return rows[0] ? rowToSession(rows[0]) : null;
}
