import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreAnswer } from "./agent";
import { CALIBRATION_OPENER, emptyProfile, recordScoredAnswer } from "./flow";
import { attribution } from "./scoring";
import type { InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state can never leak to or be mutated by the client. State
 * transitions live in the pure `flow`/`scoring` modules; the one external call —
 * the per-Turn LLM scoring in `agent` — is orchestrated here, between load and
 * save, so a refresh mid-loop resumes from the persisted Session (ADR-0011).
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Create a fresh in-progress Session, seeded with the fixed Calibration opener. */
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
      traces: [],
      pendingQuestion: CALIBRATION_OPENER,
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
    traces: row.traces,
    pendingQuestion: row.pendingQuestion,
  };
}

/**
 * Score a participant's free-text answer against the Marker Catalog, fold the
 * result into the Session, and persist it. The single Claude call happens here
 * (server-side only); the pure engine applies the cited deltas and advances the
 * flow. If the Session is already complete the answer is ignored and the row is
 * returned unchanged.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  if (state.status === "complete") return row;

  const question = state.pendingQuestion || CALIBRATION_OPENER;
  const { deltas, nextQuestion } = await scoreAnswer({
    question,
    answer,
    attribution: attribution(state.profile),
  });

  const next = recordScoredAnswer(state, answer, deltas, nextQuestion);

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      traces: next.traces,
      pendingQuestion: next.pendingQuestion,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
