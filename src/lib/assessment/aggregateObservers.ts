import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the equal-weight average of each
 * Observer's *individually-normalized* tribe scores — NOT a pooled bag of all
 * Observers' words. Scoring each Observer on their own first, then averaging,
 * is what keeps an Observer who happens to pick more words from gaining more
 * influence: every Observer contributes exactly one normalized profile to the
 * mean regardless of how many words they selected.
 *
 * This reuses the same pure scoring core (`score`) as the Self flow unchanged,
 * so self and others land on the identical 0–1 normalized scale and are directly
 * comparable in the report. It is `server-only` transitively (it imports the
 * word→tribe mapping via `score`); the report page computes the aggregate on the
 * server and passes only the resulting slug/name/score rows to the client.
 */

export interface ObserverAggregate {
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: for each tribe, the mean of every
   * Observer's normalized score for that tribe. All-zero when there are no
   * responses. In canonical (tribe `number`) order, matching `score`.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in input order, for the anonymous
   * per-observer drill-down (Observer 1/2/3). Carries no identifying data — an
   * entry is just that Observer's scores.
   */
  perObserver: TribeScore[][];
}

/**
 * Minimum Observer responses before the comparison report unlocks (ADR-0003).
 * Three keeps the average meaningful and preserves individual anonymity — with
 * fewer, an aggregate could effectively expose a single Observer. Tunable.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile plus each
 * Observer's individual profile. Each response is scored on its own with the
 * shared scoring core; the others profile is the per-tribe mean of those
 * profiles. Ordering follows the input, so a stable Observer 1/2/3 numbering is
 * the caller's to impose (e.g. by ordering responses by creation time).
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const count = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce((sum, scores) => {
      const tribeScore = scores.find((s) => s.slug === tribe.slug);
      return sum + (tribeScore?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });

  return { observerCount: count, others, perObserver };
}
