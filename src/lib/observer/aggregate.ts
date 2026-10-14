import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Pure equal-weight aggregation of 360 Observer responses into the "how others
 * see you" profile (issue #9, ADR-0003).
 *
 * Each Observer's words are scored **individually** with the same normalized
 * scoring core the Self flow uses (ADR-0001/0002), then the per-tribe scores are
 * averaged with equal weight across Observers. Averaging individually-normalized
 * scores — rather than pooling everyone's words into one bag and scoring once —
 * is deliberate: pooling would let an Observer who selects more words dominate
 * the result, whereas every Observer must count the same (ADR-0003).
 *
 * The module is pure and deterministic (no I/O, input not mutated). It is
 * `server-only` because it pulls in the word→tribe mapping transitively through
 * the scoring core, which must never reach the client (ADR-0009). Loading
 * Observer rows from the database is the repository's job; this module only does
 * the math, so it stays trivially testable.
 */

/**
 * Minimum number of Observer responses before the comparison report unlocks
 * (ADR-0003). Below this the equal-weight average isn't meaningful and
 * individual-level anonymity is thin, so the report stays locked.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

export interface ObserverAggregate {
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /**
   * Each Observer's own normalized scores, in input order and canonical tribe
   * order — the anonymous per-observer drill-down (Observer 1/2/3…). The index
   * is the only identity; nothing here ties a row back to a person.
   */
  perObserver: TribeScore[][];
  /** Equal-weight average score per tribe, in canonical (tribe `number`) order. */
  others: TribeScore[];
  /** Whether at least `OBSERVER_UNLOCK_THRESHOLD` Observers have responded. */
  unlocked: boolean;
}

/**
 * Aggregate Observer word selections into the equal-weight "others" profile.
 * Each entry in `responses` is one Observer's selected words; scoring applies
 * the same set semantics as the Self flow (unknown words and duplicates ignored,
 * exact match). With no Observers the result is an all-zero, locked profile.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, observer) => sum + observer[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return {
    observerCount,
    perObserver,
    others,
    unlocked: observerCount >= OBSERVER_UNLOCK_THRESHOLD,
  };
}
