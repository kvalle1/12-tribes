import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { generateOpeningQuestion, scoreAnswer } from "./agent";
import { appendAnswer, emptyPosture, emptyProfile, stubResult } from "./flow";
import { applyScoring } from "./scoring";
import type { InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state and the LLM calls can never leak to or be mutated by
 * the client. State transitions live in the pure `flow`/`scoring` modules; the
 * LLM interpretation lives in `agent`; this layer only loads, orchestrates the
 * Turn, applies the results, and saves.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/**
 * Create a fresh in-progress Session, seeding its first (LLM-produced) question,
 * and return its row. The opening question is generated up front and persisted
 * so a refresh resumes on the same question (ADR-0011).
 */
export async function createInterviewSession(
  userId?: string | null,
): Promise<InterviewSessionRow> {
  const pendingQuestion = await generateOpeningQuestion();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: "in_progress",
      profile: emptyProfile(),
      posture: emptyPosture(),
      turns: [],
      trace: [],
      turnCount: 0,
      pendingQuestion,
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

/** Project a persisted row onto the pure flow/scoring state. */
function toState(row: InterviewSessionRow): InterviewState {
  return {
    status: row.status,
    turns: row.turns,
    profile: row.profile,
    posture: row.posture,
    trace: row.trace,
  };
}

/**
 * Record a participant's free-text answer against a Session: record the Turn,
 * score the answer against the Marker Catalog (LLM → validated deltas), fold the
 * deltas into the running profile/posture/trace, and persist. Returns the
 * updated row. If the Session is already complete, or has no question awaiting an
 * answer, the answer is ignored and the existing row is returned unchanged.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  const question = row.pendingQuestion;
  // Nothing to answer (already complete, or no pending question) — no-op.
  if (state.status === "complete" || !question) return row;

  // The index of the Turn we are about to record — stamped onto the trace.
  const turnIndex = state.turns.length;
  const withTurn = appendAnswer(state, question, answer);

  // Score the answer and fold the cited deltas into the running state.
  const deltas = await scoreAnswer(question, answer);
  const scored = applyScoring(withTurn, turnIndex, deltas);

  const result = withTurn.status === "complete" ? stubResult(withTurn) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: withTurn.status,
      turns: withTurn.turns,
      turnCount: withTurn.turns.length,
      profile: scored.profile,
      posture: scored.posture,
      trace: scored.trace,
      // Slice 3 stops after one Turn; slice 4 sets the next question here.
      pendingQuestion: withTurn.status === "complete" ? null : question,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
