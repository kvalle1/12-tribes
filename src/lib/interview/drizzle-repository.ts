import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import type { InterviewRepository } from "./repository";
import type { Session } from "./types";

/**
 * Drizzle/Neon-backed {@link InterviewRepository} — the runtime persistence for
 * Interview Sessions (ADR-0011). The whole running state lives in one
 * `interview_session` row (`turns` and `profile` as JSONB), written on every
 * Turn so a refresh or closed tab resumes mid-flight.
 *
 * Server-only: it imports the database client and must never be bundled into a
 * client component.
 */
export class DrizzleInterviewRepository implements InterviewRepository {
  async create(session: Session): Promise<void> {
    await db.insert(interviewSessions).values({
      id: session.id,
      userId: session.userId,
      status: session.status,
      turns: session.turns,
      profile: session.profile,
      turnCount: session.turnCount,
    });
  }

  async load(id: string): Promise<Session | null> {
    const [row] = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, id))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      status: row.status,
      turns: row.turns,
      profile: row.profile,
      turnCount: row.turnCount,
    };
  }

  async save(session: Session): Promise<void> {
    await db
      .update(interviewSessions)
      .set({
        status: session.status,
        turns: session.turns,
        profile: session.profile,
        turnCount: session.turnCount,
        updatedAt: new Date(),
      })
      .where(eq(interviewSessions.id, session.id));
  }
}
