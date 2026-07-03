import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreAnswer } from "./agent";
import {
  OPENING_QUESTION,
  deriveInterviewResult,
  emptyStrengthProfile,
  recordScoredTurn,
} from "./flow";
import type { InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state and the Marker Catalog can never leak to or be mutated
 * by the client. This layer orchestrates one Turn — load → score (Claude call in
 * `agent.ts`) → apply (pure `flow.ts`) → save — while every state-transition
 * decision stays in the pure modules.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Create a fresh in-progress Session (showing the opening question) and return its row. */
export async function createInterviewSession(
  userId?: string | null,
): Promise<InterviewSessionRow> {
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: "in_progress",
      profile: emptyStrengthProfile(),
      turns: [],
      turnCount: 0,
      trace: [],
      currentQuestion: OPENING_QUESTION,
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
    trace: row.trace,
    currentQuestion: row.currentQuestion,
  };
}

/**
 * Score a participant's answer against the Marker Catalog and persist the
 * resulting Session state. The Claude call runs first; only if it succeeds is
 * the answer folded in and saved — so a failed model call leaves the Session
 * resumable at the same question rather than recording an unscored Turn. If the
 * Session is already complete (or has no pending question) the answer is ignored
 * and the row is returned unchanged.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  if (state.status === "complete" || !state.currentQuestion) return row;

  const { deltas, nextQuestion } = await scoreAnswer({
    question: state.currentQuestion,
    answer,
    history: state.turns,
  });

  const next = recordScoredTurn(state, { answer, deltas, nextQuestion });
  const result = next.status === "complete" ? deriveInterviewResult(next) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      trace: next.trace,
      currentQuestion: next.currentQuestion,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
