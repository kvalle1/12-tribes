import "server-only";

import { normalize } from "./scoring";
import type {
  InterviewResult,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * The Confidence / Stop evaluator (ADR-0006) — pure functions that read the
 * running Strength Profile and decide whether the Interview has enough evidence
 * to report, and what it reports: a Primary (or Co-Primaries) plus a dynamic
 * Contender band.
 *
 * Scoring is status-blind (ADR-0007): nothing here reads a tribe's `status`, so
 * every one of the 12 tribes, disqualified ones included, is eligible as
 * Primary. Status only shapes report framing, later.
 *
 * The thresholds are tunable constants, not calibrated against real data yet.
 */

/** No result before this many answers, however decisive they look. */
export const MIN_TURNS = 6;

/** Hard cap on Turns: bounds the worst-case length (and cost) of an Interview. */
export const MAX_TURNS = 18;

/** The leader must be unchanged over this many most-recent Turns to stop. */
export const STABILITY_TURNS = 3;

/** A tribe scoring at least this fraction of the leader is a Contender. */
export const CONTENDER_BAND = 0.75;

/** A tribe scoring at least this fraction of the leader is inseparable from it. */
export const CO_PRIMARY_BAND = 0.9;

/**
 * How many standard errors the Primary must lead the highest non-Contender by.
 * The gap is judged against `sqrt(leader + runner)` — the noise you would expect
 * from that much accumulated evidence — so a thin early lead does not pass, and
 * the same absolute gap counts for less as evidence piles up.
 */
export const MARGIN_Z = 2;

/** The leader-vs-runner gap in standard errors of the evidence behind them. */
function marginZ(leader: number, runner: number): number {
  const evidence = leader + runner;
  if (evidence <= 0) return 0;
  return (leader - runner) / Math.sqrt(evidence);
}

/** Whether the Primary's lead over the highest non-Contender is decisive. */
export function marginIsDecisive(leader: number, runner: number): boolean {
  return marginZ(leader, runner) >= MARGIN_Z;
}

/** Tribes ordered strongest first; ties break by slug so ranking is deterministic. */
function rank(profile: StrengthProfile): { slug: string; score: number }[] {
  return Object.entries(profile)
    .map(([slug, score]) => ({ slug, score }))
    .sort((a, b) => b.score - a.score || (a.slug < b.slug ? -1 : 1));
}

/**
 * Who the profile currently names, with no stopping logic: the Primary set (the
 * leader plus anything inseparable from it), the Contender band, and display
 * percentages. Confidence is the margin over the highest non-Contender, as a
 * fraction of what the Stop Condition needs (capped at 1).
 */
export function summarize(profile: StrengthProfile): InterviewResult {
  const ranked = rank(profile);
  const percentages = normalize(profile);
  const leader = ranked[0]?.score ?? 0;

  if (leader <= 0) {
    return { primary: [], contenders: [], coPrimary: false, confidence: 0, percentages };
  }

  const primary = ranked.filter((r) => r.score >= leader * CO_PRIMARY_BAND).map((r) => r.slug);
  const contenders = ranked.filter((r) => r.score >= leader * CONTENDER_BAND).map((r) => r.slug);
  const runner = ranked.find((r) => r.score < leader * CONTENDER_BAND)?.score ?? 0;

  return {
    primary,
    contenders,
    coPrimary: primary.length > 1,
    confidence: Math.min(1, marginZ(leader, runner) / MARGIN_Z),
    percentages,
  };
}

/**
 * The leader after each of the first `turnCount` Turns, replayed from the score
 * trace — so ranking stability needs no extra persisted state. A Turn with no
 * evidence yet has a null leader.
 */
export function rankingHistory(
  trace: readonly ScoreTraceEntry[],
  turnCount: number,
): (string | null)[] {
  const running: StrengthProfile = {};
  const leaders: (string | null)[] = [];
  for (let turn = 0; turn < turnCount; turn++) {
    for (const entry of trace) {
      if (entry.turnIndex === turn) {
        running[entry.tribeSlug] = (running[entry.tribeSlug] ?? 0) + entry.delta;
      }
    }
    const top = rank(running)[0];
    leaders.push(top && top.score > 0 ? top.slug : null);
  }
  return leaders;
}

export interface Verdict {
  decision: "continue" | "stop";
  /** Why the Interview stopped: the Stop Condition held, or the cap was reached. */
  reason: "confident" | "cap" | null;
  result: InterviewResult;
}

/**
 * Decide, after a Turn, whether to ask another question or report. Stops when
 * the floor, a decisive relative margin, a stable leader, and a separable
 * Primary all hold — or unconditionally at the cap, where inseparable top
 * tribes are reported as Co-Primaries rather than forcing a razor-thin winner.
 *
 * "Stable top ordering" (ADR-0006) is read as the leader being unchanged;
 * Contender churn below it does not block stopping, since the Contender band is
 * reported as a set anyway.
 */
export function evaluate(
  profile: StrengthProfile,
  trace: readonly ScoreTraceEntry[],
  turnCount: number,
): Verdict {
  const result = summarize(profile);

  if (turnCount >= MAX_TURNS) {
    return { decision: "stop", reason: "cap", result };
  }

  const recent = rankingHistory(trace, turnCount).slice(-STABILITY_TURNS);
  const stable =
    recent.length === STABILITY_TURNS &&
    recent[0] !== null &&
    recent.every((leader) => leader === recent[0]);

  const confident =
    turnCount >= MIN_TURNS &&
    result.confidence >= 1 &&
    stable &&
    !result.coPrimary;

  return confident
    ? { decision: "stop", reason: "confident", result }
    : { decision: "continue", reason: null, result };
}
