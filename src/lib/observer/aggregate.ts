import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the **equal-weight average of each
 * observer's individually-normalized tribe scores** — not a pooled bag of words.
 * Each observer's words are scored through the same coverage-fair scoring core
 * the Self Assessment uses (`score`, ADR-0001), producing a normalized 0–1
 * profile; those per-observer profiles are then averaged with equal weight. An
 * observer who selects more words therefore gains no extra influence: every
 * observer contributes exactly one normalized profile to the average.
 *
 * This module is `server-only` because it reaches the word→tribe mapping through
 * `score` (ADR-0009 trust boundary). The comparison report is a server component
 * that calls this and passes only the resulting plain numbers to the client.
 */

/**
 * The comparison report unlocks only once at least this many observers have
 * responded (ADR-0003). Below it the average is too thin to be meaningful and
 * individual anonymity is weak, so the report stays locked.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough observers have responded for the comparison report to unlock. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

export interface ObserverAggregation {
  /** How many observer responses went into the aggregation. */
  observerCount: number;
  /**
   * The equal-weight average per-tribe "others" profile, in canonical (tribe
   * `number`) order — the mean of the per-observer normalized scores.
   */
  others: TribeScore[];
  /**
   * Each observer's individually-normalized profile, in canonical order, in the
   * same order the responses were given. Anonymous: positional only (Observer 1,
   * 2, 3…), carrying nothing that identifies who responded.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus each observer's own normalized profile for the anonymous
 * drill-down. `responses` is one entry per observer, each the words that
 * observer selected. The input is never mutated. With no responses the average
 * is all-zero across the twelve tribes.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregation {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe, i) => {
    const sum = perObserver.reduce(
      (total, observer) => total + observer[i].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });

  return { observerCount, others, perObserver };
}
