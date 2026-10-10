import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003) — the "how others see you" profile.
 *
 * Each Observer's words are scored individually with the same pure scoring core
 * the Self Assessment uses (reused unchanged), then the per-tribe scores are
 * **averaged across observers with equal weight**. This is deliberately *not* a
 * pooled bag of words: an Observer who selects more words does not gain more
 * influence, because every Observer's profile is normalized to 0–1 before it is
 * averaged in. Effort (word count) never becomes influence.
 *
 * Server-only because it imports the scoring core (and so the word→tribe
 * mapping, ADR-0009). Render its output from a server component only.
 */

/**
 * Observers required before the comparison report unlocks (ADR-0003). Below
 * this, the average is too thin to be meaningful and individual anonymity is
 * weak, so the report stays locked.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function hasEnoughObservers(count: number): boolean {
  return count >= OBSERVER_UNLOCK_THRESHOLD;
}

/** The only thing aggregation needs from an observer row: its selected words. */
export interface ObserverWordSelection {
  readonly words: readonly string[];
}

/**
 * The equal-weight "others" profile: a normalized 0–1 score for every tribe in
 * canonical (tribe `number`) order — the same shape as `score`, so the result
 * view and ranking helpers treat it identically to a self profile. With no
 * observers, every tribe scores 0 (never divides by zero).
 */
export function aggregateObservers(
  responses: readonly ObserverWordSelection[],
): TribeScore[] {
  const count = responses.length;

  const sums: Record<string, number> = {};
  for (const tribe of tribes) sums[tribe.slug] = 0;

  for (const response of responses) {
    for (const tribeScore of score(response.words)) {
      sums[tribeScore.slug] += tribeScore.score;
    }
  }

  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: count > 0 ? sums[tribe.slug] / count : 0,
  }));
}
