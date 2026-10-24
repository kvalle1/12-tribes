import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of the 360 Observer responses for a Subject (issue
 * #9, ADR-0003). The "how others see you" profile is the mean of each observer's
 * *individually-normalized* tribe scores — never a pooled bag of words — so an
 * observer who selects more words does not gain more influence.
 *
 * Each observer's words run through the same `score` core the Self Assessment
 * uses, which already normalizes by tribe coverage (ADR-0001), so every
 * observer's scores sit on the same 0–1 scale before they are averaged. That
 * normalization is exactly what makes equal-weight averaging meaningful: we
 * average comparable per-observer profiles, not raw word counts.
 *
 * Pure and dependency-free apart from the scoring core, so it is unit-testable
 * in isolation. It carries the scoring core (and thus the word→tribe mapping)
 * transitively, so it is `server-only` and never reaches the client (ADR-0009).
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks (ADR-0003). Three is the point at which the average is meaningful and
 * individual anonymity is preserved.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

export interface AggregatedObservers {
  /** How many Observers responded. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: per tribe, the mean of every observer's
   * normalized score. In canonical (tribe `number`) order, like `score`.
   */
  average: TribeScore[];
  /**
   * Each observer's individual normalized scores (canonical order), in the order
   * the responses were given — the data behind the anonymous Observer 1/2/3
   * drill-down. Carries no observer identity.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the per-observer breakdown. Each entry in `responses` is one
 * Observer's selected words. The caller's arrays are not mutated.
 *
 * With no responses the average is the canonical all-zero table, so callers can
 * render a consistent 12-tribe shape before the report unlocks.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): AggregatedObservers {
  const perObserver = responses.map((words) => score(words));
  return {
    observerCount: responses.length,
    average: averageScores(perObserver),
    perObserver,
  };
}

/**
 * The per-tribe mean of a set of per-observer score tables. Every table is in
 * canonical order (guaranteed by `score`), so tribes line up by index. With no
 * observers this returns the canonical all-zero table from `score([])`.
 */
function averageScores(perObserver: readonly TribeScore[][]): TribeScore[] {
  if (perObserver.length === 0) return score([]);

  const n = perObserver.length;
  return perObserver[0].map((tribe, i) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: perObserver.reduce((sum, observer) => sum + observer[i].score, 0) / n,
  }));
}
