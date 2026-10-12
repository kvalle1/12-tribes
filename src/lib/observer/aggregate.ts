import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into a "how
 * others see you" Strength Profile (issue #9, ADR-0003).
 *
 * Each Observer is scored individually with the same coverage-normalized core
 * the Self Assessment uses (`score`), then the per-tribe scores are averaged
 * with **equal weight per observer** — not pooled into one bag of words. This is
 * the ADR-0003 decision: an Observer who selects more words must not gain more
 * influence, so effort (word count) never becomes weight. Averaging normalized
 * profiles, rather than scoring the union of everyone's words, is what enforces
 * that.
 *
 * Pure and deterministic: it takes the raw selections and returns scores, with
 * no I/O. It is `server-only` because it pulls in the word→tribe mapping through
 * `score` (ADR-0009 trust boundary) — the aggregation runs server-side and only
 * plain numbers cross to the client.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003): enough for the average to mean something and to keep any
 * single Observer anonymous within the pool.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

export interface ObserverAggregate {
  /** How many Observers have responded. */
  observerCount: number;
  /** Whether the comparison report may be shown (`observerCount >= threshold`). */
  unlocked: boolean;
  /**
   * The equal-weight average "others" profile — one normalized score per tribe,
   * in canonical (tribe `number`) order. All-zero when there are no Observers.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in the order the selections were
   * given (the caller orders them stably, e.g. by response time, so the
   * anonymous "Observer 1 / 2 / 3" drill-down labels stay fixed). Carries no
   * identity — it is purely the per-observer scores behind the average.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate Observer word-selections into the equal-weight "others" profile plus
 * each Observer's individual profile for the anonymous drill-down. Selections
 * should already be in a stable order; the result's `perObserver` preserves it.
 */
export function aggregateObservers(
  observerSelections: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = observerSelections.map((words) => score(words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, profile) =>
        sum + (profile.find((t) => t.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return {
    observerCount,
    unlocked: observerCount >= OBSERVER_UNLOCK_THRESHOLD,
    others,
    perObserver,
  };
}
