import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (ADR-0003, issue
 * #9). Each Observer's selected words are scored with the *same* normalized core
 * as the Self Assessment (`score`), then those per-observer normalized profiles
 * are averaged with **equal weight** — so an Observer who selects more words
 * does not gain more influence than one who selects fewer.
 *
 * This is deliberately an average of per-observer *normalized* profiles, never a
 * pooled bag of every observer's words scored once: pooling would let an
 * Observer's word count become influence (more words light up more tribes),
 * which is exactly what equal-weight averaging avoids.
 *
 * Pure apart from the scoring core and free of any database or request state, so
 * its external behaviour is unit-testable without a DB. `server-only` because it
 * pulls in the word→tribe mapping via `score`; aggregation runs on the server.
 */

/** Observers required before the comparison report unlocks (ADR-0003). */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

export interface ObserverAggregate {
  /** How many Observers have responded. */
  observerCount: number;
  /** Whether the comparison report unlocks (observerCount ≥ the threshold). */
  unlocked: boolean;
  /**
   * The equal-weight average of each Observer's normalized scores, one entry per
   * tribe in canonical (tribe `number`) order. All-zero when no Observer has
   * responded, so the shape is always the full twelve tribes.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized scores, in the order the responses were
   * given, backing the anonymous per-observer drill-down (Observer 1, 2, 3 …).
   * Carries no observer identity — just their scored profile.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the per-observer breakdown. `responses` is one entry per
 * Observer, each the words that Observer selected; order is preserved so the
 * drill-down's "Observer N" labels stay stable for a given input.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  // A zero-word score gives the canonical twelve-tribe order and names, so
  // `average` always carries every tribe even with no observers. `score` always
  // returns tribes in this same order, so index `i` is the same tribe across
  // every observer's profile.
  const template = score([]);
  const average: TribeScore[] = template.map((tribe, i) => {
    const sum = perObserver.reduce((total, obs) => total + obs[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });

  return {
    observerCount,
    unlocked: observerCount >= OBSERVER_UNLOCK_THRESHOLD,
    average,
    perObserver,
  };
}
