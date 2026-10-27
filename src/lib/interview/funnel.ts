import "server-only";

import { tribes } from "@/lib/tribes";
import { CO_PRIMARY_BAND, profileHistory, rank, summarize } from "./confidence";
import type { InterviewState } from "./types";

/**
 * The Funnel planner (ADR-0005) — pure functions that decide what kind of Turn
 * comes next. A fixed, broad **Calibration** opening touches every tribe's
 * territory at low resolution before anything narrows (the anti-anchoring
 * floor); then **Discrimination** aims each question at separating the live
 * Contenders, biased to *demote the leader* and *promote a dark horse* rather
 * than confirm the current #1. When two Contenders stay stuck in a tie, the
 * planner calls for a **Dilemma** (ADR-0008).
 *
 * The planner only decides the *kind* of Turn and its target; the agent writes
 * the wording, and `isNeutralPhrasing` screens that wording so narrowing never
 * turns into coaching. Like the Confidence / Stop evaluator, the planner reads
 * no tribe `status` (ADR-0007), and its thresholds are tunable constants.
 */

/**
 * The fixed Calibration opening, asked in order. Broad situation/behaviour
 * prompts that leave room for every tribe's Markers to surface unprompted:
 * identity and joy, the role taken in a group under strain, what others draw
 * from you, and what carried you through hardship. Shortening this to "save
 * questions" trades away the bias protection it exists for (ADR-0005).
 */
export const CALIBRATION_QUESTIONS: readonly string[] = [
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?",
  "When a group you're part of faces a hard problem, what part do you naturally end up playing, and what do you tend to notice that others miss?",
  "What do people most often come to you for? What do you give them that seems to cost you the least?",
  "Tell me about a hard season you've come through. What kept you going, and what did it show you about yourself?",
];

/** How many Turns the Calibration opening lasts. */
export const CALIBRATION_TURNS = CALIBRATION_QUESTIONS.length;

/**
 * A Dilemma is called for only when the same top two tribes have been
 * inseparable (within the Co-Primary band) for this many consecutive Turns — a
 * *stubborn* tie that free-text questions have not broken.
 */
export const DILEMMA_TIE_TURNS = 3;

/** The fixed framing shown above a Dilemma's two situations. */
export const DILEMMA_PROMPT =
  "Here are two situations. Which would you choose, and why? There's no right answer — the reasoning matters most.";

export type FunnelPhase = "calibration" | "discrimination";

/** Who a Discrimination Turn should try to separate. */
export interface DiscriminationTarget {
  /** The current leader — the question should be able to count against it. */
  demote: string;
  /** Live Contenders below the leader, then the strongest dark horse outside the band. */
  promote: string[];
}

/** The planner's decision for the next Turn. */
export type TurnPlan =
  | { phase: "calibration"; kind: "question"; prompt: string }
  | { phase: "discrimination"; kind: "question"; target: DiscriminationTarget | null }
  | {
      phase: "discrimination";
      kind: "dilemma";
      target: DiscriminationTarget | null;
      /** The two tribes stuck in the tie the Dilemma should break. */
      pair: [string, string];
    };

/** The slice of Session state the planner reads. */
export type FunnelState = Pick<InterviewState, "profile" | "trace" | "turns">;

/** The phase of the Turn at `turnIndex` (0-based). */
export function phaseFor(turnIndex: number): FunnelPhase {
  return turnIndex < CALIBRATION_TURNS ? "calibration" : "discrimination";
}

/**
 * Who to separate: the leader to demote, and the tribes to give a chance —
 * every other live Contender, plus the strongest tribe outside the Contender
 * band as a dark horse. Null before any evidence exists.
 */
function discriminationTarget(state: FunnelState): DiscriminationTarget | null {
  const { contenders } = summarize(state.profile);
  if (contenders.length === 0) return null;
  const [leader, ...rest] = contenders;
  const darkHorse = rank(state.profile).find((r) => !contenders.includes(r.slug));
  return { demote: leader, promote: darkHorse ? [...rest, darkHorse.slug] : rest };
}

/**
 * The tied pair if the same top two tribes have been inseparable after each of
 * the last `DILEMMA_TIE_TURNS` of the first `turnCount` Turns, else null.
 */
function stubbornTie(state: FunnelState, turnCount: number): [string, string] | null {
  const recent = profileHistory(state.trace, turnCount).slice(-DILEMMA_TIE_TURNS);
  if (recent.length < DILEMMA_TIE_TURNS) return null;

  let pair: [string, string] | null = null;
  for (const profile of recent) {
    const [first, second] = rank(profile);
    if (!first || !second || first.score <= 0) return null;
    if (second.score < first.score * CO_PRIMARY_BAND) return null;
    const current: [string, string] = [first.slug, second.slug].sort() as [string, string];
    if (pair && (pair[0] !== current[0] || pair[1] !== current[1])) return null;
    pair = current;
  }
  return pair;
}

/**
 * Plan the Turn at `turnIndex` from evidence over the first `turnCount` Turns.
 * `lastWasDilemma` keeps Dilemmas a narrow tie-breaker: never two in a row.
 */
function plan(
  state: FunnelState,
  turnIndex: number,
  turnCount: number,
  lastWasDilemma: boolean,
): TurnPlan {
  if (phaseFor(turnIndex) === "calibration") {
    return { phase: "calibration", kind: "question", prompt: CALIBRATION_QUESTIONS[turnIndex] };
  }
  const target = discriminationTarget(state);
  const pair = lastWasDilemma ? null : stubbornTie(state, turnCount);
  return pair
    ? { phase: "discrimination", kind: "dilemma", target, pair }
    : { phase: "discrimination", kind: "question", target };
}

/** Plan the next Turn from the Session as it stands (every answer so far scored). */
export function planNextTurn(state: FunnelState): TurnPlan {
  const count = state.turns.length;
  return plan(state, count, count, state.turns.at(-1)?.dilemma !== undefined);
}

/**
 * Preview the plan for the Turn *after* the answer now being scored, assuming
 * that answer leaves the ranking as it is. The scoring call writes the next
 * Turn's wording in the same request that scores the answer (ADR-0009), so the
 * agent is briefed from this preview; the authoritative `planNextTurn` runs on
 * the scored state afterwards and has the final say.
 */
export function previewPlan(state: FunnelState, pendingIsDilemma = false): TurnPlan {
  const count = state.turns.length + 1;
  return plan(state, count, count, pendingIsDilemma);
}

const TRIBE_NAMES = tribes.map((t) => t.name.toLowerCase());

/**
 * Whether a proposed question or Dilemma is neutrally phrased: it must not name
 * a tribe (ADR-0005 guard 2 — narrowing must never become coaching). Matches
 * whole words only, so "danger" or "gadget" are fine.
 */
export function isNeutralPhrasing(text: string): boolean {
  const words = text.toLowerCase().split(/[^a-z]+/);
  return !words.some((word) => TRIBE_NAMES.includes(word));
}
