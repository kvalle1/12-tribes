import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreInterviewAnswer } from "./agent";
import {
  emptyProfile,
  OPENING_QUESTION,
  recordScoredTurn,
  stubResult,
} from "./flow";
import { applyScoring } from "./score";
import { getMarkerById } from "./markers";
import type { InterviewState } from "./types";

/**
 * Server-only persistence + scoring orchestration for Interview Sessions
 * (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so the Marker Catalog, scoring state, and API key never leak to or are
 * mutated by the client. Each Turn: the agent interprets the answer into cited
 * Marker deltas, the pure scoring engine applies them, and the pure flow folds
 * the result into the Session — this layer just loads, coordinates, and saves.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Create a fresh in-progress Session (starting at the opening question). */
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
    // Older rows (pre-#16) have no stored question; fall back to the opener.
    currentQuestion: row.currentQuestion ?? OPENING_QUESTION,
  };
}

/**
 * Score a participant's free-text answer against the Marker Catalog and persist
 * the resulting state. The single LLM call interprets/scores the answer and
 * chooses the next question (ADR-0009); the pure engine applies the cited deltas
 * to the Strength Profile. If the Session is already complete the answer is
 * ignored (the pure flow treats it as a no-op) and the row is returned unchanged.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  // A completed Session takes no more answers — skip the (costly) scoring call
  // and let the pure flow treat a stray submit as a no-op below.
  if (state.status === "complete") return row;

  const agentTurn = await scoreInterviewAnswer({
    question: state.currentQuestion,
    answer,
    priorQuestions: state.turns.map((t) => t.question),
  });

  const { profile, applied } = applyScoring(
    state.profile,
    agentTurn.deltas,
    getMarkerById,
  );

  const next = recordScoredTurn(state, {
    answer,
    trace: applied,
    profile,
    nextQuestion: agentTurn.nextQuestion,
  });
  const result = next.status === "complete" ? stubResult(next) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      currentQuestion: next.currentQuestion,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
