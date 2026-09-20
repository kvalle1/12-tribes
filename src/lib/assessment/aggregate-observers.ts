import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003).
 *
 * The "others" view is **not** a pooled bag of everyone's words. Each Observer is
 * scored individually through the same normalized scoring core the Subject uses
 * (so self and observer profiles are directly comparable), and the per-tribe
 * "others" profile is the plain average of those individually-normalized
 * profiles. Averaging normalized profiles — rather than pooling raw word picks —
 * means an Observer who selects more words gains no extra influence: every
 * Observer counts exactly once.
 *
 * Pure and dependency-light (only the scoring core and the tribe list), so it can
 * be unit-tested on its own and reused by the comparison report unchanged.
 */

export interface ObserverAggregate {
  /**
   * The equal-weight average per-tribe "others" profile, in canonical (tribe
   * `number`) order — the same shape and ordering as a self `score()` result, so
   * the two can be laid side by side. All-zero when there are no responses.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in the order the responses were
   * given. Anonymous by construction — an index (Observer 1, 2, 3…), never an
   * identity — backing the report's per-observer drill-down.
   */
  perObserver: TribeScore[][];
  /** How many Observer responses were aggregated. */
  count: number;
}

/**
 * Aggregate a Subject's Observer responses into an equal-weight "others" profile.
 * Each response is that Observer's selected words; each is scored independently
 * and the normalized profiles are averaged tribe-by-tribe. The input is not
 * mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const count = perObserver.length;

  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const profile of perObserver) {
    for (const tribeScore of profile) totals[tribeScore.slug] += tribeScore.score;
  }

  const others: TribeScore[] = tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: count > 0 ? totals[tribe.slug] / count : 0,
  }));

  return { others, perObserver, count };
}
