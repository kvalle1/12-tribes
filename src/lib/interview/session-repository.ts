import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import {
  createInitialState,
  type SessionState,
  type SessionStatus,
} from "./skeleton";

/**
 * Persistence for the Interview Session (ADR-0011). Thin Drizzle glue over the
 * `interview_session` table — all the state logic lives in the pure `skeleton`
 * module. Marked `server-only` so it can never be bundled into client code: the
 * Session is server-authoritative and the trust boundary is enforced here
 * (ADR-0009).
 */

/** Reconstruct the pure `SessionState` from a persisted row. */
function toState(row: typeof interviewSessions.$inferSelect): SessionState {
  return {
    profile: row.profile,
    turns: row.turns,
    turnCount: row.turnCount,
    status: row.status as SessionStatus,
  };
}

/** Create a fresh Session, optionally tied to a signed-in Account. Returns its id. */
export async function createSession(userId?: string): Promise<string> {
  const initial = createInitialState();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: initial.status,
      profile: initial.profile,
      turns: initial.turns,
      turnCount: initial.turnCount,
    })
    .returning({ id: interviewSessions.id });
  return row.id;
}

/** Load a Session's state by id, or null if no such Session exists. */
export async function loadSession(id: string): Promise<SessionState | null> {
  const [row] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, id))
    .limit(1);
  return row ? toState(row) : null;
}

/** Persist the latest state for a Session (called every Turn for resumability). */
export async function saveSession(id: string, state: SessionState): Promise<void> {
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
