import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { scoreAnswer } from "./agent";
import { appendAnswer, emptyProfile, QUESTIONS } from "./flow";
import { applyScoring, rankedProfile } from "./scoring";
import type { InterviewState, StubResult } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state can never leak to or be mutated by the client. State
 * transitions live in the pure `flow` module and the pure `scoring` engine; this
 * layer loads a Session, runs the answer through the LLM scorer, applies the
 * cited deltas, and saves the result.
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
      trace: [],
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
    trace: row.trace,
  };
}

/** A lightweight headline for a completed Session; the full ranking is derived from `profile`. */
function summarize(state: InterviewState): StubResult {
  const [top] = rankedProfile(state.profile);
  if (!top || top.score === 0) {
    return {
      headline: "Your interview is complete.",
      note: "Your answer didn't surface a clear signal yet — a fuller interview (more Turns) arrives in a later slice.",
    };
  }
  return {
    headline: `Your strongest signal so far: ${top.name}`,
    note: "Here is how each tribe scored from what you shared.",
  };
}

/**
 * Record a participant's free-text answer against a Session: fold it into the
 * Turn history, score it against the Marker Catalog via the LLM, apply the cited
 * deltas to the running profile, and persist the updated row (profile + trace).
 * Returns the updated row, or null if the Session doesn't exist. If the Session
 * is already complete the answer is a no-op and the existing row is returned.
 *
 * Scoring is best-effort: if the model call fails, the Turn is still recorded
 * (with no new deltas) so a transient LLM error can't strand the participant.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const current = toState(row);
  // The question the participant is answering (before we append the Turn).
  const question = QUESTIONS[current.turns.length] ?? QUESTIONS[QUESTIONS.length - 1];

  const withTurn = appendAnswer(current, answer);
  // No-op if the Session was already complete: nothing was appended, don't rescore.
  if (withTurn === current) return row;

  let deltas: Awaited<ReturnType<typeof scoreAnswer>>["deltas"] = [];
  try {
    ({ deltas } = await scoreAnswer(question, answer));
  } catch {
    // Fail soft: keep the flow moving even if the scorer is unavailable.
    deltas = [];
  }

  const scored = applyScoring(withTurn.profile, answer, deltas);
  const next: InterviewState = {
    ...withTurn,
    profile: scored.profile,
    trace: [...withTurn.trace, ...scored.trace],
  };
  const result = next.status === "complete" ? summarize(next) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      trace: next.trace,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
