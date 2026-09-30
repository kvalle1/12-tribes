import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure aggregation of the 360 Observer responses into a single "others" profile
 * (issue #9, ADR-0003). Each Observer is scored **individually** with the same
 * normalized scoring core the Subject uses, and the results are combined as an
 * **equal-weight average** per tribe — so an Observer who selects more words does
 * not gain more influence than one who selects fewer. This is deliberately *not*
 * a pooled bag of words (which would let a verbose Observer dominate); every
 * Observer contributes one vote, already normalized to 0–1, and the votes are
 * averaged.
 *
 * Like the scoring core it builds on, this module is `server-only`: it pulls in
 * the word→tribe mapping (via `score`) which never reaches the client
 * (ADR-0009). It is otherwise pure and dependency-free, so the comparison report
 * and its tests reuse it unchanged.
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks (ADR-0003). Below this, the "others" view isn't meaningful and a
 * single Observer's response could be de-anonymized, so the report stays locked.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/**
 * Aggregate a set of Observer responses (each a list of selected words) into the
 * equal-weight "others" profile: for every tribe, the mean of the Observers'
 * individually-normalized 0–1 scores. Returns a score for all twelve tribes in
 * canonical (tribe `number`) order — the same shape `score` returns — so the
 * report can line the "others" profile up against the Subject's own directly.
 *
 * With no responses, every tribe scores 0. The input is not mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;

  for (const words of responses) {
    for (const tribeScore of score(words)) {
      totals[tribeScore.slug] += tribeScore.score;
    }
  }

  const divisor = responses.length || 1;

  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: totals[tribe.slug] / divisor,
  }));
}
