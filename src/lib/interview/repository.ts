import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { interviewSessions } from "@/db/schema";
import {
  composeDilemmaAnswer,
  scoreAnswer,
  type FunnelGuidance,
  type ScoreAnswer,
} from "./agent";
import { applyTurn, initialState } from "./flow";
import { contenderTargets, OPENING_QUESTION, phaseFor } from "./funnel";
import type {
  DilemmaChoice,
  InterviewState,
  InterviewTurn,
  PendingTurn,
} from "./types";

/**
 * Server-only persistence for Interview Sessions (ADR-0009 trust boundary).
 *
 * The `server-only` import makes importing this from a client bundle a build
 * error, so scoring state can never leak to or be mutated by the client. All
 * decisions about state transitions live in the pure `flow` / `funnel` modules;
 * this layer only loads, applies, and saves.
 */

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** The prompt text for a pending Turn (a Dilemma's framing, or the question). */
function promptOf(pending: PendingTurn): string {
  return pending.kind === "dilemma" ? pending.dilemma.prompt : pending.prompt;
}

/** The plain-question prompt to mirror into the legacy `pendingQuestion` column. */
function legacyPendingQuestion(pending: PendingTurn | null): string | null {
  return pending?.kind === "question" ? pending.prompt : null;
}

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
      turns: state.turns,
      turnCount: 0,
      trace: state.trace,
      pendingQuestion: legacyPendingQuestion(state.pendingTurn),
      pendingTurn: state.pendingTurn,
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
 * Project a persisted row onto the pure flow state. New rows carry the full
 * `pendingTurn`; pre-slice-5 rows have only `pendingQuestion`, so an in-progress
 * one of those is reconstructed as a plain question at the Funnel phase its Turn
 * count implies (ADR-0011 resumability). A completed Session has no pending Turn.
 */
export function toState(row: InterviewSessionRow): InterviewState {
  let pendingTurn: PendingTurn | null;
  if (row.pendingTurn) {
    pendingTurn = row.pendingTurn;
  } else if (row.status === "complete") {
    pendingTurn = null;
  } else {
    pendingTurn = {
      kind: "question",
      phase: phaseFor(row.turns.length),
      prompt: row.pendingQuestion ?? OPENING_QUESTION,
    };
  }
  return {
    status: row.status,
    turns: row.turns,
    profile: row.profile,
    trace: row.trace,
    pendingTurn,
    result: row.status === "complete" ? row.result : null,
  };
}

/** What the participant submitted for the pending Turn. */
export type TurnSubmission =
  | { kind: "question"; answer: string }
  | { kind: "dilemma"; choice: DilemmaChoice; why: string };

/**
 * Resolve a submission against the pending Turn: the free-text to score and the
 * completed Turn to record. For a Dilemma the scored text is the trade-off plus
 * the "why" (ADR-0008) — never the bare option — while the Turn retains the
 * posed situations and the choice for auditability.
 */
function resolveSubmission(
  pending: PendingTurn,
  submission: TurnSubmission,
): { scoredAnswer: string; turn: InterviewTurn } | null {
  if (pending.kind === "question" && submission.kind === "question") {
    return {
      scoredAnswer: submission.answer,
      turn: { question: pending.prompt, answer: submission.answer },
    };
  }
  if (pending.kind === "dilemma" && submission.kind === "dilemma") {
    const { id, pair, optionA, optionB } = pending.dilemma;
    return {
      scoredAnswer: composeDilemmaAnswer(pending.dilemma, submission.choice, submission.why),
      turn: {
        question: pending.dilemma.prompt,
        answer: submission.why,
        dilemma: { id, pair, optionA, optionB, choice: submission.choice },
      },
    };
  }
  // A submission whose kind doesn't match the pending Turn is a stale form.
  return null;
}

/**
 * Record a participant's submission for a Session, score it, and persist the
 * resulting state — one Turn of the loop (ADR-0009). Returns the updated row. If
 * the Session is already complete the submission is ignored and the existing row
 * is returned unchanged.
 *
 * The scoring call runs here on the server: the answer (or Dilemma trade-off) is
 * scored into validated, catalog-bounded Marker deltas, and the model is given
 * Funnel steering (ADR-0005) so its proposed next question separates the live
 * Contenders. The pure flow folds the deltas in, the Stop Condition decides
 * whether to report (ADR-0006), and the Funnel planner chooses the next Turn.
 * The scorer is injected (defaulting to the real agent) so this seam is
 * substitutable.
 *
 * `expectedTurnCount` is the Turn count the participant's form was rendered at; a
 * mismatch means the submission was to a different Turn, so it is ignored. The
 * write is likewise conditional on that Turn count, so a concurrent double submit
 * cannot record the same Turn twice.
 */
export async function recordInterviewTurn(
  id: string,
  submission: TurnSubmission,
  expectedTurnCount: number,
  scorer: ScoreAnswer = scoreAnswer,
): Promise<InterviewSessionRow | null> {
  const row = await getInterviewSession(id);
  if (!row) return null;

  // A stale form (e.g. a second tab still showing an earlier Turn) must not be
  // recorded as the answer to whatever Turn is pending now.
  if (row.turnCount !== expectedTurnCount) return row;

  const state = toState(row);
  if (state.status === "complete" || state.pendingTurn === null) return row;

  const resolved = resolveSubmission(state.pendingTurn, submission);
  if (!resolved) return row;

  // Steer the proposed next question toward separating the live Contenders when
  // the next Turn will be Discrimination. Contenders are read from the profile as
  // it stands before this answer — the best signal available at call time.
  const targets = contenderTargets(state.profile);
  const guidance: FunnelGuidance = {
    phase: phaseFor(state.turns.length + 1),
    contenders: targets.contenders,
    leader: targets.leader,
    darkHorse: targets.darkHorse,
  };

  const scored = await scorer({
    question: promptOf(state.pendingTurn),
    answer: resolved.scoredAnswer,
    history: state.turns,
    guidance,
  });
  const next = applyTurn(state, resolved.turn, scored);

  const [updated] = await db
    .update(interviewSessions)
    .set({
      status: next.status,
      turns: next.turns,
      turnCount: next.turns.length,
      profile: next.profile,
      trace: next.trace,
      pendingQuestion: legacyPendingQuestion(next.pendingTurn),
      pendingTurn: next.pendingTurn,
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
