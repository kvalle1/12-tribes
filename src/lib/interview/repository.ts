import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreAnswer, type ScoreAnswer } from "./agent";
import { applyTurn, initialState, OPENING_QUESTION } from "./flow";
import { previewPlan } from "./funnel";
import type { DilemmaChoice, InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state can never leak to or be mutated by the client. All
 * decisions about state transitions live in the pure `flow` module; this layer
 * only loads, applies, and saves.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Create a fresh in-progress Session and return its row (incl. generated id). */
export async function createInterviewSession(
  userId?: string | null,
): Promise<InterviewSessionRow> {
  const state = initialState();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: state.status,
      profile: state.profile,
      posture: state.posture,
      turns: state.turns,
      turnCount: 0,
      trace: state.trace,
      pendingQuestion: state.pendingQuestion,
      pendingDilemma: state.pendingDilemma,
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

/**
 * Project a persisted row onto the pure flow state. Sessions created before
 * slice 4 have no `pendingQuestion`; an in-progress one of those has not been
 * answered yet (the old flow completed after one Turn), so it resumes at the
 * opening question.
 */
export function toState(row: InterviewSessionRow): InterviewState {
  const legacyPending = row.status === "in_progress" ? OPENING_QUESTION : null;
  return {
    status: row.status,
    turns: row.turns,
    profile: row.profile,
    // Sessions created before slice 6 have no Posture tallies; an empty map
    // reads as "unknown" for every tribe and grows lazily as Turns are scored.
    posture: row.posture ?? {},
    trace: row.trace,
    pendingQuestion: row.pendingQuestion ?? legacyPending,
    pendingDilemma: row.status === "in_progress" ? (row.pendingDilemma ?? null) : null,
    result: row.status === "complete" ? row.result : null,
  };
}

/**
 * Record a participant's free-text answer against a Session, score it, and
 * persist the resulting state — one Turn of the loop (ADR-0009). Returns the
 * updated row. If the Session is already complete the answer is ignored and the
 * existing row is returned unchanged.
 *
 * The scoring call runs here on the server: the answer is scored into
 * validated, catalog-bounded Marker deltas plus a proposed next question, and
 * the pure flow folds them in and applies the Stop Condition (ADR-0006). The
 * scorer is injected (defaulting to the real agent) so this seam is
 * substitutable. The agent is briefed with the Funnel planner's preview of the
 * next Turn (ADR-0005) so it can word a targeted question or draft a Dilemma.
 *
 * A pending Dilemma needs the participant's `choice`; an answer without one is
 * ignored, like a stale form.
 *
 * `expectedTurnCount` is the Turn count the participant's form was rendered
 * at; a mismatch means the answer was to a different question, so it is
 * ignored. The write is likewise conditional on the Turn count it was computed
 * from, so a concurrent double submit cannot record the same Turn twice: the
 * losing write changes nothing and the current row is returned instead.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
  expectedTurnCount: number,
  { choice, scorer = scoreAnswer }: { choice?: DilemmaChoice; scorer?: ScoreAnswer } = {},
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  // A stale form (e.g. a second tab still showing an earlier question) must not
  // be recorded as the answer to whatever question is pending now.
  if (row.turnCount !== expectedTurnCount) return row;

  const state = toState(row);
  if (state.status === "complete" || state.pendingQuestion === null) return row;
  if (state.pendingDilemma && !choice) return row;

  const dilemma = state.pendingDilemma ?? undefined;
  const scored = await scorer({
    question: state.pendingQuestion,
    answer,
    history: state.turns,
    dilemma,
    choice: dilemma ? choice : undefined,
    plan: previewPlan(state, dilemma !== undefined),
  });
  const next = applyTurn(state, answer, scored, choice);

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      posture: next.posture,
      trace: next.trace,
      pendingQuestion: next.pendingQuestion,
      pendingDilemma: next.pendingDilemma,
      result: next.result,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.turnCount, row.turnCount),
      ),
    )
    .returning();
  return updated ?? getInterviewSession(id);
}
