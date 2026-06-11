import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { createInitialState, type InterviewState } from "./session";

/**
 * Server-only persistence for Interview Sessions (ADR-0011). Every Turn is
 * written back so a refresh resumes mid-flight. These functions import the
 * database client and must never run on the client.
 */

/** Create a fresh Session row and return its generated id. */
export async function createInterviewSession(
  userId: string | null,
): Promise<string> {
  const initial = createInitialState();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId,
      status: initial.status,
      turns: initial.turns,
      turnCount: initial.turnCount,
      profile: initial.profile,
    })
    .returning({ id: interviewSessions.id });
  return row.id;
}

/** Load a Session's running state, or `null` if no such Session exists. */
export async function getInterviewSession(
  id: string,
): Promise<InterviewState | null> {
  const [row] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, id))
    .limit(1);

  if (!row) return null;

  return {
    status: row.status,
    turns: row.turns,
    turnCount: row.turnCount,
    profile: row.profile,
  };
}

/** Persist the updated running state for a Session. */
export async function updateInterviewSession(
  id: string,
  state: InterviewState,
): Promise<void> {
  await db
    .update(interviewSessions)
    .set({
      status: state.status,
      turns: state.turns,
      turnCount: state.turnCount,
      profile: state.profile,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id));
}
