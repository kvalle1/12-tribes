import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of the 360 Observer responses for one Subject (issue
 * #9, ADR-0003) — the "others" side of the self-vs-others comparison.
 *
 * Each Observer is scored on their own with the same pure Self scoring core
 * (`score`), which normalizes by coverage to a 0–1 value per tribe. The "others"
 * profile is then the **equal-weight average** of those per-observer vectors:
 * every Observer contributes exactly one normalized vote, so an Observer who
 * selects more words does not gain more influence than one who selects fewer.
 * This is deliberately *not* a pooled bag of words (which would let a verbose
 * Observer dominate) — the distinction the tests pin down.
 *
 * The module is pure (no DB, no request state) so it unit-tests cleanly; the
 * repository supplies the stored word-lists. `server-only` keeps it — and the
 * word→tribe mapping it pulls in via `score` — off the client (ADR-0009).
 */

/** The report unlocks only once at least this many Observers have responded. */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function hasEnoughObservers(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_TO_UNLOCK;
}

/**
 * Score each Observer's selected words independently, returning one normalized
 * `TribeScore[]` (canonical tribe order) per Observer, in the order given. The
 * caller keeps the responses anonymous and stably ordered so these map to
 * "Observer 1", "Observer 2", … in the drill-down.
 */
export function scoreEachObserver(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight average "others" profile across all Observer responses, as a
 * normalized `TribeScore[]` in canonical tribe order (the same shape `score`
 * returns, so it drops straight into `rankScores` and the result view). Returns
 * an all-zero profile when no Observers have responded.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreEachObserver(responses);
  const count = perObserver.length;

  return tribes.map((tribe, index) => {
    // `score` returns tribes in canonical order, so column `index` is this tribe
    // across every observer — sum that column and divide by the observer count.
    const total = perObserver.reduce((sum, obs) => sum + obs[index].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });
}
