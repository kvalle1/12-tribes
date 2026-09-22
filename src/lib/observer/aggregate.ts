import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "others" read is the **equal-weight average of each Observer's own
 * normalized profile** — not a pooled bag of everyone's words. Each Observer is
 * scored individually by the shared scoring core (so their profile is already
 * coverage-normalized, ADR-0001), then the per-tribe scores are averaged with
 * one vote per Observer. This deliberately means an Observer who selects more
 * words does not gain more influence than one who selects fewer: pooling the raw
 * words would let a heavy selector dominate, which this avoids.
 *
 * Pure and dependency-light (only the scoring core) so its external behavior is
 * unit-testable. `server-only` because it pulls in the scoring core, which
 * carries the word→tribe mapping that must never reach the client (ADR-0009).
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks. Below this the aggregate is too thin — and too easy to de-anonymize —
 * to show (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS;
}

export interface ObserverAggregate {
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
  /**
   * The equal-weight average per-tribe score across all Observers, in canonical
   * (tribe `number`) order. Each Observer contributes equally regardless of how
   * many words they picked.
   */
  averaged: TribeScore[];
  /**
   * Each Observer's own normalized profile, in canonical order, in the same
   * order the responses were passed in. Anonymous: the index is all that
   * distinguishes them (Observer 1, 2, …), never any identity.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a set of Observer responses (each a list of selected words) into the
 * equal-weight "others" profile plus each Observer's individual profile for the
 * anonymous drill-down. Passing no responses yields an all-zero average and an
 * empty per-Observer list.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  return {
    observerCount: responses.length,
    averaged: averageScores(perObserver),
    perObserver,
  };
}

/**
 * Average a list of canonical-order score tables position-by-position, one vote
 * each. Uses an empty score() as the canonical all-zero base so the result keeps
 * every tribe in canonical order even when there are no tables to average.
 */
function averageScores(tables: readonly TribeScore[][]): TribeScore[] {
  const base = score([]);
  if (tables.length === 0) return base;

  return base.map((tribe, i) => ({
    slug: tribe.slug,
    name: tribe.name,
    score:
      tables.reduce((sum, table) => sum + table[i].score, 0) / tables.length,
  }));
}
