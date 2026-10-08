import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";
import { tribes } from "@/lib/tribes";

/**
 * Pure equal-weight aggregation of 360 Observer responses into a single "how
 * others see you" profile (issue #9, ADR-0003).
 *
 * The "others" profile is the **equal-weight average of each Observer's
 * individually-normalized tribe scores** — explicitly *not* a pooled bag of all
 * observers' words. Each Observer is scored on their own with the same scoring
 * core the Self flow uses (`score`, ADR-0001), and those normalized tables are
 * averaged tribe-by-tribe. Because every Observer contributes exactly one
 * normalized table regardless of how many words they picked, an Observer who
 * selects more words never gains more influence.
 *
 * Reuses the scoring core unchanged, so it inherits exactly the Self flow's
 * handling of unknown words, duplicates, and shared-word weighting — self and
 * observer numbers stay directly comparable. It imports `server-only` (via
 * `score`) so the word→tribe mapping never reaches the client (ADR-0009); the
 * report page computes the profile server-side and ships only the numbers.
 */

/**
 * Observers needed before the comparison report unlocks (ADR-0003). Below this
 * the average isn't meaningful and individual anonymity is weaker, so the report
 * stays locked.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/**
 * Score each Observer response on its own, returning one normalized tribe-score
 * table per response in input order. This is the per-observer view the report's
 * anonymous drill-down ("Observer 1/2/3") renders, and the input to the
 * equal-weight average below.
 */
export function scoreEachObserver(
  responses: readonly (readonly string[])[],
): TribeScore[][] {
  return responses.map((words) => score(words));
}

/**
 * The equal-weight mean, per tribe, of already-scored observer tables. Each
 * table must be in canonical (tribe `number`) order — as `score` and
 * `scoreEachObserver` produce — so index `i` is the same tribe across tables.
 * Returns a 0–1 score for all twelve tribes in that same canonical order. With
 * no tables every tribe is 0.
 *
 * Split out so a caller that already needs the per-observer tables (the report's
 * drill-down) can average them directly instead of re-scoring every observer.
 */
export function averageScores(
  perObserver: readonly TribeScore[][],
): TribeScore[] {
  return tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, table) => sum + table[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });
}

/**
 * The equal-weight "others" profile: the mean, per tribe, of each Observer's
 * individually-normalized score. Returns a 0–1 score for all twelve tribes in
 * canonical (tribe `number`) order, matching `score`. With no observers every
 * tribe is 0.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  return averageScores(scoreEachObserver(responses));
}
