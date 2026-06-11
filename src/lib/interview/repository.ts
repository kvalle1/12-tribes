import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import type { InterviewSessionState } from "./session";

/**
 * Persistence for the Interview Session (ADR-0011). The row is the single
 * source of truth for scoring state; callers load it, apply a pure transition
 * from `session.ts`, and save it back — one write per Turn.
 */

export interface InterviewSessionRow extends InterviewSessionState {
  id: string;
  userId: string | null;
}

type DbRow = typeof interviewSessions.$inferSelect;

function toRow(row: DbRow): InterviewSessionRow {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    profile: row.profile,
    posture: row.posture,
    turns: row.turns,
    turnCount: row.turnCount,
  };
}

export async function loadSession(
  id: string,
): Promise<InterviewSessionRow | null> {
  const rows = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, id))
    .limit(1);
  const row = rows[0];
  return row ? toRow(row) : null;
}

export async function createSession(
  state: InterviewSessionState,
  userId: string | null,
): Promise<string> {
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId,
      status: state.status,
      profile: state.profile,
      posture: state.posture,
      turns: state.turns,
      turnCount: state.turnCount,
    })
    .returning({ id: interviewSessions.id });
  return row.id;
}

export async function saveSession(
  id: string,
  state: InterviewSessionState,
): Promise<void> {
  await db
    .update(interviewSessions)
    .set({
      status: state.status,
      profile: state.profile,
      posture: state.posture,
      turns: state.turns,
      turnCount: state.turnCount,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id));
}
