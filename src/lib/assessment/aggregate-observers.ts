import "server-only";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (ADR-0003, issue #9).
 *
 * The "how others see you" profile is the **equal-weight average of each
 * observer's individually-normalized tribe scores** — NOT a pooled bag of words.
 * Each observer is scored on their own with the same normalized scoring core the
 * Subject uses, so an observer who happens to pick more words does not gain more
 * influence: every observer contributes one vote per tribe, and those votes are
 * averaged. Pooling all observers' words into a single `score()` call would let a
 * prolific observer dominate; averaging per-observer profiles deliberately does
 * not.
 *
 * The module is pure and reuses `score` unchanged (ADR-0002: the Strength Profile
 * is the shared output shape), so its behavior is unit-testable without the DB or
 * any UI. It imports the `server-only` scoring core, so it runs server-side only.
 */

/**
 * The minimum number of observer responses before the comparison report unlocks
 * (ADR-0003). Below this, individual observers could be identified and the
 * average isn't meaningful, so the report stays locked.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

export interface ObserverAggregate {
  /**
   * The equal-weight "others" profile: one normalized 0–1 score per tribe, in
   * canonical (tribe `number`) order — the mean of every observer's own
   * normalized score for that tribe. All zeros when there are no observers.
   */
  scores: TribeScore[];
  /**
   * Each observer's individual normalized profile, in input order, for the
   * anonymous per-observer drill-down (Observer 1 / 2 / 3…). Carries no observer
   * identity — just their scored profile.
   */
  perObserver: TribeScore[][];
  /** How many observer responses were aggregated. */
  observerCount: number;
}

/**
 * Whether enough observers have responded for the comparison report to unlock.
 */
export function canUnlockReport(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_TO_UNLOCK;
}

/**
 * Aggregate a Subject's observer responses into the equal-weight "others"
 * profile plus each observer's individual profile.
 *
 * `responses` is one entry per observer, each the words that observer selected.
 * Every observer is scored independently and normalized by the scoring core;
 * the returned `scores` are the per-tribe mean of those individual profiles, so
 * each observer is weighted equally regardless of how many words they picked.
 * With no responses, `scores` is an all-zero profile and `observerCount` is 0.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));

  // Canonical tribe order and names come from any per-observer profile (all
  // share the same order); fall back to an empty `score([])` when there are no
  // observers so the all-zero profile still has every tribe in order.
  const template = perObserver[0] ?? score([]);

  const scores: TribeScore[] = template.map((tribe, i) => {
    const total = perObserver.reduce((sum, obs) => sum + obs[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return { scores, perObserver, observerCount: responses.length };
}
