import { score, type TribeScore } from "./score";
import { tribes } from "@/lib/tribes";

/**
 * Pure 360 "others" aggregation (issue #9, ADR-0003). Given the anonymous
 * Observer responses for one Subject, it produces the equal-weight "others"
 * profile the comparison report draws alongside the Subject's own.
 *
 * Each Observer is scored **individually** with the same normalized scoring core
 * the Self flow uses (`score`), then the per-tribe scores are averaged with equal
 * weight across Observers. Because every Observer's vector is already normalized
 * to 0–1 before averaging, an Observer who selects more words does not gain more
 * influence — the average is over people, not over a pooled bag of words
 * (ADR-0003). The module is pure and dependency-free (beyond the scoring core and
 * the `tribes` source of truth) so it can be unit-tested through its public
 * interface and reused unchanged by the report.
 */

/** The number of Observer responses required before the report unlocks (ADR-0003). */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function isObserverReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

export interface ObserverAggregate {
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
  /**
   * The equal-weight average of the Observers' individually-normalized scores,
   * one entry per tribe in canonical (tribe `number`) order. Zeroed for every
   * tribe when there are no Observers.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized scores, in the input order, fully anonymous —
   * the report surfaces these as "Observer 1 / 2 / 3" with no identifying data.
   * Each inner array is a full 12-tribe table in canonical order.
   */
  perObserver: TribeScore[][];
}

/** A zeroed 12-tribe score table in canonical order — the empty "others" profile. */
function zeroedScores(): TribeScore[] {
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: 0,
  }));
}

/**
 * Aggregate anonymous Observer responses into the equal-weight "others" profile.
 * `responses` is one Observer per entry, each a list of selected words. Unknown
 * words and duplicates are handled by the underlying `score`, so callers can pass
 * raw stored selections. With no responses the aggregate is all-zero and
 * `perObserver` is empty — the report's locked state, not this function, decides
 * when there are too few Observers to show.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));

  if (perObserver.length === 0) {
    return { observerCount: 0, others: zeroedScores(), perObserver };
  }

  // Equal-weight average per tribe: sum each Observer's normalized score for the
  // tribe, divide by the Observer count. Canonical tribe order is preserved
  // because every `score` result is already in that order.
  const others = tribes.map((tribe, index) => {
    const total = perObserver.reduce(
      (sum, observer) => sum + observer[index].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: total / perObserver.length,
    };
  });

  return { observerCount: perObserver.length, others, perObserver };
}
