import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { startInterview, type InterviewState } from "@/lib/interview/session";

/**
 * Persistence for the Interview Session (ADR-0011). The running profile and Turn
 * history live only here and in the server-authoritative loop; importing `@/db`
 * binds this module to the server, so it never reaches the client bundle.
 */

/** Map a stored row to the pure state machine's shape. */
function toState(row: typeof interviewSessions.$inferSelect): InterviewState {
  return {
    status: row.status,
    profile: row.profile,
    turns: row.turns,
    turnCount: row.turnCount,
  };
}

/** Create a fresh Session (optionally tied to an Account) and return its id. */
export async function createInterviewSession(
  userId: string | null,
): Promise<string> {
  const initial = startInterview();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId,
      status: initial.status,
      profile: initial.profile,
      turns: initial.turns,
      turnCount: initial.turnCount,
    })
    .returning({ id: interviewSessions.id });
  return row.id;
}

/** Load a Session's state by id, or null if it does not exist. */
export async function getInterviewState(
  id: string,
): Promise<InterviewState | null> {
  const [row] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, id));
  return row ? toState(row) : null;
}

/** Persist the latest state for a Session (written every Turn). */
export async function saveInterviewState(
  id: string,
  state: InterviewState,
): Promise<void> {
  await db
    .update(interviewSessions)
    .set({
      status: state.status,
      profile: state.profile,
      turns: state.turns,
      turnCount: state.turnCount,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id));
}
