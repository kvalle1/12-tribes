import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into a single
 * "how others see you" profile (issue #9, ADR-0003).
 *
 * Each Observer is scored **individually** with the same normalized scoring core
 * the Self flow uses (`score`), then the per-tribe scores are averaged with equal
 * weight across observers. Averaging individually-normalized profiles — rather
 * than pooling everyone's words into one bag before scoring — is the whole point:
 * an Observer who selects more words produces a profile with more non-zero
 * tribes, but it still counts as exactly one profile in the average, so effort
 * (word count) never becomes influence.
 *
 * Pure and dependency-light: it composes `score` and does arithmetic, holding no
 * database or request state, so its external behavior is fully unit-testable. It
 * is `server-only` because `score` carries the word→tribe mapping, which must
 * never reach the client (ADR-0009).
 */

/**
 * How many Observer responses must exist before the comparison report unlocks
 * (ADR-0003). Below this the average isn't meaningful and, at the individual
 * level, anonymity is weaker — so the report stays locked.
 */
export const MIN_OBSERVERS = 3;

export interface ObserverAggregate {
  /** Number of Observer responses that went into the aggregate. */
  observerCount: number;
  /** Whether enough Observers have responded for the report to unlock (≥3). */
  unlocked: boolean;
  /**
   * The equal-weight average per-tribe score, one entry per tribe in canonical
   * (tribe `number`) order. Every tribe is present; with no observers all
   * scores are 0.
   */
  average: TribeScore[];
  /**
   * Each Observer's own individually-normalized scores, in canonical order, in
   * the same order the responses were passed in. Backs the anonymous
   * "Observer 1 / 2 / 3" drill-down — carries scores only, never identity.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a set of Observer word selections into the equal-weight "others"
 * profile. `observerWordSets` is one entry per Observer (their selected words);
 * each is scored on its own via `score` (which dedups and drops unknown words),
 * and the resulting per-tribe scores are averaged with equal weight.
 *
 * Returns a zeroed, locked aggregate for an empty input. The `average` and every
 * `perObserver` entry list all twelve tribes in canonical order, so callers can
 * line them up tribe-for-tribe against a Self profile without re-sorting.
 */
export function aggregateObservers(
  observerWordSets: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = observerWordSets.map((words) => score(words));
  const observerCount = perObserver.length;

  // Canonical tribe list/order comes from scoring any selection; use an empty
  // one so we always have the full twelve tribes even with no observers.
  const template = score([]);

  const average: TribeScore[] = template.map((tribe, i) => {
    const total = perObserver.reduce((sum, obs) => sum + obs[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return {
    observerCount,
    unlocked: observerCount >= MIN_OBSERVERS,
    average,
    perObserver,
  };
}
