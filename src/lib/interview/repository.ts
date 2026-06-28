import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { generateOpeningQuestion, scoreAnswer } from "./agent";
import { deriveResult, emptyProfile, recordScoredAnswer } from "./flow";
import { getMarkerById } from "./markers";
import type { MarkerLookup } from "./scoring";
import type { InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state and the Marker Catalog never leak to the client. The
 * pure `flow`/`scoring` modules own all state transitions; the agent owns the
 * LLM calls; this layer loads, calls them, and saves.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/**
 * Adapts the server-only Marker Catalog into the scoring engine's injected
 * lookup, so the engine itself stays pure and catalog-free.
 */
const markerLookup: MarkerLookup = (id) => {
  const marker = getMarkerById(id);
  return marker
    ? { tribeSlug: marker.tribeSlug, type: marker.type, weight: marker.weight }
    : undefined;
};

/** Create a fresh in-progress Session — generating the opening question — and return its row. */
export async function createInterviewSession(
  userId?: string | null,
): Promise<InterviewSessionRow> {
  const openingQuestion = await generateOpeningQuestion();
  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: "in_progress",
      profile: emptyProfile(),
      turns: [],
      turnCount: 0,
      trace: [],
      pendingQuestion: openingQuestion,
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
    pendingQuestion: row.pendingQuestion,
  };
}

/**
 * Score a participant's free-text answer and persist the resulting state. Calls
 * the agent to interpret the answer against the Marker Catalog, folds the cited
 * deltas into the Strength Profile via the pure flow, and saves. If the Session
 * is already complete (or has no pending question) the answer is ignored and the
 * existing row is returned unchanged.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  if (state.status === "complete" || !state.pendingQuestion) return row;

  const deltas = await scoreAnswer(state.pendingQuestion, answer, state.turns);
  const next = recordScoredAnswer(state, answer, deltas, markerLookup);
  const result = next.status === "complete" ? deriveResult(next) : null;

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
