import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreAnswer } from "./agent";
import {
  OPENING_QUESTION,
  emptyProfile,
  initialState,
  interviewResult,
  recordScoredTurn,
} from "./flow";
import type { InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so the Marker Catalog, scoring, and LLM calls can never leak to or be
 * mutated by the client. State transitions live in the pure `flow`/`score`
 * modules and the LLM call in the `agent` client; this layer only loads, calls
 * the agent, applies the result, and saves.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Create a fresh in-progress Session and return its row (incl. generated id). */
export async function createInterviewSession(
  userId?: string | null,
): Promise<InterviewSessionRow> {
  const start = initialState();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: start.status,
      profile: start.profile,
      turns: start.turns,
      turnCount: 0,
      trace: start.trace,
      pendingQuestion: start.pendingQuestion,
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
    profile: row.profile ?? emptyProfile(),
    trace: row.trace ?? [],
    // Older rows predate pendingQuestion; fall back to the opener.
    pendingQuestion: row.pendingQuestion || OPENING_QUESTION,
  };
}

/**
 * Record a participant's free-text answer against a Session: score it against
 * the Marker Catalog via the agent (server-side only), fold the cited deltas
 * into the profile and trace, and persist the resulting state. Returns the
 * updated row. If the Session is already complete the answer is ignored (the
 * pure flow treats it as a no-op) and the existing row is returned unchanged.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  if (state.status === "complete") return row;

  const scored = await scoreAnswer({
    question: state.pendingQuestion,
    answer,
    history: state.turns,
  });

  const next = recordScoredTurn(state, {
    answer,
    deltas: scored.deltas,
    nextQuestion: scored.nextQuestion,
  });
  const result = next.status === "complete" ? interviewResult(next) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      trace: next.trace,
      pendingQuestion: next.pendingQuestion,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
