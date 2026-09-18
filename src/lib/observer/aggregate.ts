import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the **equal-weight average of each
 * observer's individually-normalized tribe scores** — not a pooled bag of
 * words. Because each observer is scored on their own (via the same normalized
 * scoring core the Self flow uses) and then averaged, an observer who selects
 * more words does not gain more influence: every observer counts for exactly
 * `1/N`. Pooling all observers' words into one selection would instead let the
 * most prolific observer dominate, which ADR-0003 explicitly rejects.
 *
 * This module is `server-only` because the scoring core it depends on carries
 * the word→tribe mapping (ADR-0009 trust boundary). It returns only numeric
 * per-tribe scores, so a server component can safely hand the *result* to the
 * client without leaking the mapping.
 */

/**
 * Minimum observer responses before the comparison report unlocks. Below this,
 * the average is too thin to be meaningful and — with per-observer drill-down —
 * individual anonymity is not yet protected (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

/** Whether the comparison report may be shown for a given observer count. */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

export interface ObserverComparison {
  /** How many observer responses went into this aggregation. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the mean of the per-observer normalized
   * scores, one entry per tribe in canonical (tribe `number`) order.
   */
  average: TribeScore[];
  /**
   * Each observer's own normalized scores, in canonical order, preserving the
   * input order. Backs the anonymous per-observer drill-down (Observer 1/2/3);
   * it carries no observer identity, only scores.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate observer responses into the equal-weight "others" profile.
 *
 * Each response is one observer's selected words. Every response is scored
 * independently and normalized by the shared scoring core, then the per-tribe
 * scores are averaged with equal weight across observers. With no responses the
 * average is all zeros (never a divide-by-zero) so callers can render a locked
 * state without special-casing.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverComparison {
  const perObserver = responses.map((words) => score(words));

  const average = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, obs) => sum + obs[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return { observerCount: perObserver.length, average, perObserver };
}
