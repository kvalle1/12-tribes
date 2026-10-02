import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). The "how others see you" profile is the **equal-weight average of
 * each observer's individually-normalized tribe scores** — each observer is
 * scored on their own with the shared scoring core, then those per-observer
 * profiles are averaged with equal weight. One observer who selects more words
 * therefore gains no extra influence: pooling every observer's words into a
 * single score would let the longest selection dominate, which is exactly the
 * behavior this choice rejects.
 *
 * This reuses the Self flow's `score` unchanged (ADR-0002: the Strength Profile
 * is the shared output shape), so observer and self profiles are directly
 * comparable. It is `server-only` because it pulls in the word→tribe mapping via
 * `score`; the aggregation runs server-side and only the resulting scores cross
 * to the client (ADR-0009 trust boundary).
 */

/**
 * The comparison report unlocks only once at least this many observers have
 * responded — enough to make the average meaningful and to preserve each
 * individual observer's anonymity in the drill-down (ADR-0003).
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether enough observers have responded to unlock the comparison report. */
export function observersUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}

/** A 12-tribe table of all-zero scores in canonical order. */
function zeroProfile(): TribeScore[] {
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: 0,
  }));
}

/**
 * Score each observer's selection independently, returning one normalized
 * 12-tribe table per observer in the input order. Used for the anonymous
 * per-observer drill-down (Observer 1 / 2 / 3) in the comparison report.
 */
export function scorePerObserver(
  selections: readonly (readonly string[])[],
): TribeScore[][] {
  return selections.map((words) => score(words));
}

/**
 * The equal-weight "others" profile: the per-tribe arithmetic mean of each
 * observer's normalized score. Returns an all-zero table (never dividing by
 * zero) when there are no observers. The result is a normal Strength Profile in
 * canonical (tribe `number`) order, so it ranks and renders exactly like a self
 * profile.
 */
export function aggregateObservers(
  selections: readonly (readonly string[])[],
): TribeScore[] {
  const observerCount = selections.length;
  if (observerCount === 0) return zeroProfile();

  const perObserver = scorePerObserver(selections);

  return tribes.map((tribe) => {
    const total = perObserver.reduce((sum, profile) => {
      const entry = profile.find((t) => t.slug === tribe.slug);
      return sum + (entry ? entry.score : 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: total / observerCount,
    };
  });
}
