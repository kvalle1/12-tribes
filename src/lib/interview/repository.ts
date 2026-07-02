import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreAnswer } from "./agent";
import { appendScoredAnswer, currentQuestion, nextTurn } from "./flow";
import { applyDeltas, deriveResult, emptyProfile } from "./scoring";
import type { InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state, the Marker Catalog, and the API key can never leak to
 * or be mutated by the client. State-transition decisions live in the pure
 * `flow` module and the pure Scoring engine; the Claude call lives in `agent`.
 * This layer orchestrates: load → score answer → apply deltas → append → save.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Create a fresh in-progress Session and return its row (incl. generated id). */
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
      nextQuestion: null,
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
    nextQuestion: row.nextQuestion,
  };
}

/**
 * Record a participant's free-text answer against a Session: score it against
 * the Marker Catalog via Claude (ADR-0009), fold the cited deltas into the
 * running Strength Profile with the pure Scoring engine (ADR-0003/0004), persist
 * the result, and return the updated row.
 *
 * If the Session is already complete the answer is ignored and the existing row
 * is returned unchanged. The answer is only persisted once scoring succeeds, so
 * a failed Claude call leaves the Session resumable at the same Turn.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  if (nextTurn(state).kind === "result") return row; // already complete

  const question = currentQuestion(state);

  // One Claude call scores the answer and picks the next question (ADR-0009).
  const { deltas, nextQuestion } = await scoreAnswer({
    question,
    answer,
    priorTurns: state.turns,
  });

  // The pure engine validates the cited Markers and applies them additively.
  const { profile, applied } = applyDeltas(state.profile, deltas);

  const next = appendScoredAnswer(state, {
    question,
    answer,
    deltas: applied,
    profile,
    nextQuestion,
  });

  const result = next.status === "complete" ? deriveResult(next.profile) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      nextQuestion: next.nextQuestion,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
