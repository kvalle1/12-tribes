import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import { settleTurn, stubResult, TOTAL_QUESTIONS } from "./flow";
import { createInterpreter, type Interpreter } from "./interpreter";
import { applyScoredTurn, emptyPosture, emptyStrengthProfile } from "./scoring";
import type { InterviewState } from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR 0009 trust boundary).
 *
 * The `server-only` import turns any client import into a build error, so
 * neither the LLM interpreter nor the scoring engine can accidentally reach the
 * client bundle. All decisions about state transitions live in the pure `flow`
 * and `scoring` modules; this layer loads state, hands it to the interpreter,
 * folds the deltas in, and saves — the DB and the LLM are the only impure
 * concerns.
 *
 * An injectable `interpreter` factory keeps this testable without a network:
 * production callers pass none and get the default (real Anthropic client);
 * integration tests can inject a fake to drive the state machine.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/**
 * Create a fresh in-progress Session. Also asks the interpreter for the
 * opening question so the participant sees a real, model-authored question on
 * the very first render — a hardcoded fallback would waste a Turn and defeats
 * the point of the agent-driven flow (ADR 0005).
 *
 * If the interpreter call fails we still persist the Session (so the id
 * exists) but leave `currentQuestion` null; the caller can retry from
 * `/interview` — resume semantics take care of it.
 */
export async function createInterviewSession(
  userId?: string | null,
  interpreter: Interpreter = createInterpreter(),
): Promise<InterviewSessionRow> {
  let opening: string | null = null;
  try {
    opening = await interpreter.openingQuestion();
  } catch {
    opening = null;
  }

  const [row] = await db
    .insert(interviewSessions)
    .values({
      userId: userId ?? null,
      status: "in_progress",
      profile: emptyStrengthProfile(),
      posture: emptyPosture(),
      turns: [],
      turnCount: 0,
      currentQuestion: opening,
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
 * Project a persisted row onto the pure flow state. Older rows may lack
 * `posture` or `currentQuestion` (the columns landed with this slice's
 * migration); we default them here so pre-migration Sessions still project
 * cleanly rather than erroring on a `null`.
 */
function toState(row: InterviewSessionRow): InterviewState {
  return {
    status: row.status,
    turns: row.turns,
    profile: row.profile,
    posture: row.posture ?? emptyPosture(),
    currentQuestion: row.currentQuestion ?? null,
  };
}

/**
 * Record a participant's answer for the current Turn: hand the answer +
 * history to the interpreter, fold the returned deltas into state, install the
 * next question (or complete the Session at the question floor), and persist.
 *
 * A single-Turn Interview is the slice-3 horizon (issue #16); slice #17
 * generalizes this to loop until the Confidence / Stop evaluator says stop.
 * The shape doesn't change here — only the stopping condition — so the
 * multi-Turn loop reuses this method's contract.
 */
export async function recordInterviewAnswer(
  id: string,
  answer: string,
  interpreter: Interpreter = createInterpreter(),
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  const state = toState(row);
  if (state.status === "complete") {
    return row;
  }
  if (!state.currentQuestion) {
    // A refresh at the moment a Session was created but before the opening
    // landed: nothing to score. Callers can retry once the question is set.
    return row;
  }

  const { scored, nextQuestion } = await interpreter.scoreAnswer({
    question: state.currentQuestion,
    answer,
    priorTurns: state.turns.map(({ question, answer: a }) => ({
      question,
      answer: a,
    })),
  });

  const applied = applyScoredTurn(state, answer, scored);
  const settled = settleTurn(
    applied,
    applied.turns.length >= TOTAL_QUESTIONS ? null : nextQuestion,
  );

  const result = settled.status === "complete" ? stubResult(settled) : null;

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: settled.status,
      turns: settled.turns,
      turnCount: settled.turns.length,
      profile: settled.profile,
      posture: settled.posture,
      currentQuestion: settled.currentQuestion,
      result,
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, id))
    .returning();
  return updated;
}
