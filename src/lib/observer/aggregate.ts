import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). Each Observer is scored individually with the same normalized core
 * as the Self Assessment, then the per-tribe scores are **averaged across
 * observers** — not pooled into one bag of words. Averaging normalized profiles
 * is what makes the weight equal: an Observer who selects more words produces a
 * profile, not more votes, so word count (effort) never becomes influence.
 *
 * `server-only`: it reuses the scoring core, which carries the word→tribe mapping
 * that must never reach the client (ADR-0009). Pure and dependency-free beyond
 * that core, so its external behavior is unit-tested directly.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below the threshold the average isn't meaningful and
 * individual anonymity is weaker, so the report stays locked.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** One anonymous Observer's selected words — the only thing a response carries. */
export interface ObserverResponse {
  words: readonly string[];
}

/**
 * The equal-weight "others" profile: for each of the twelve tribes (canonical
 * order), the mean of every Observer's individually-normalized score for that
 * tribe. With no observers, every tribe scores 0.
 */
export function aggregateObservers(
  responses: readonly ObserverResponse[],
): TribeScore[] {
  const perObserver = responses.map((response) => score(response.words));
  const count = perObserver.length;

  return tribes.map((tribe) => {
    const total = perObserver.reduce((sum, observerScores) => {
      const forTribe = observerScores.find((s) => s.slug === tribe.slug);
      return sum + (forTribe?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });
}
