import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into a single
 * "how others see you" profile (issue #9, ADR-0003).
 *
 * Each Observer is scored individually by the same normalized scoring core the
 * Self Assessment uses (`score`), then the per-tribe scores are averaged across
 * Observers. Averaging *already-normalized* per-observer profiles — rather than
 * pooling everyone's words into one bag and scoring that — is the whole point:
 * an Observer who selects more words does not gain more influence, because
 * normalization caps each Observer's contribution at a 0–1 profile before the
 * mean is taken.
 *
 * Server-only (it pulls in the word→tribe mapping via `score`); render it from
 * server components only, like the scoring core and the result view.
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks (ADR-0003). Three both makes the equal-weight average meaningful and
 * preserves individual anonymity — no single Observer can be singled out.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

/**
 * Score each Observer response individually, returning one normalized profile
 * per Observer in the order supplied. Each profile lists all twelve tribes in
 * canonical order (the shape `score` returns), so profiles can be averaged or
 * shown as an anonymous per-observer drill-down without re-ordering.
 */
export function scoreObservers(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe mean of each Observer's
 * individually-normalized score, in canonical tribe order. With no Observers
 * every tribe scores 0. Pure (given a fixed word list) and order-independent.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const profiles = scoreObservers(responses);

  return tribes.map((tribe, i) => {
    const total = profiles.reduce((sum, profile) => sum + profile[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: profiles.length > 0 ? total / profiles.length : 0,
    };
  });
}
