import type { interviewSessions } from "@/db/schema";
import type { InterviewSession, SessionStatus } from "@/lib/interview/session";

/**
 * Pure row↔domain mappers for Interview Sessions, kept separate from the Drizzle
 * I/O (`interview-repository.ts`) so they can be unit-tested without importing
 * the database client (which requires `DATABASE_URL` at import time).
 */

export type SessionRow = typeof interviewSessions.$inferSelect;
export type SessionInsert = typeof interviewSessions.$inferInsert;

/** Map a database row to the domain Session. */
export function rowToSession(row: SessionRow): InterviewSession {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as SessionStatus,
    turns: row.turns,
    pendingPrompt: row.pendingPrompt,
    profile: row.profile,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Map a domain Session to the row values written on insert. */
export function sessionToInsert(session: InterviewSession): SessionInsert {
  return {
    id: session.id,
    userId: session.userId,
    status: session.status,
    turns: session.turns,
    pendingPrompt: session.pendingPrompt,
    profile: session.profile,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
