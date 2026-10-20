import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses into a single "others"
 * Strength Profile (issue #9, ADR-0003).
 *
 * Each Observer is scored **individually** by the same pure core the Self flow
 * uses (`score`), which normalizes every tribe to 0–1 against the points
 * available for it across the whole word list. The aggregate is then the
 * **equal-weight average** of those per-observer normalized profiles: every
 * Observer contributes exactly `1/N`, so an Observer who selects more words —
 * or whose picks pile onto one tribe — does not gain more influence than one
 * who selects fewer. This is deliberately *not* a pooled bag of words (which
 * would let a prolific Observer dominate); it averages finished profiles, not
 * raw selections.
 *
 * Pure and dependency-free apart from the scoring core: it takes the Observers'
 * already-fetched word selections and returns scores, doing no I/O of its own.
 * It stays `server-only` because it pulls in the word→tribe mapping through
 * `score` (the ADR-0009 trust boundary), and is unit-testable because the test
 * run stubs `server-only`.
 */

/**
 * Minimum number of Observer responses before the comparison report unlocks.
 * Below this the "others" read is too thin to be fair or anonymous, so the
 * report stays locked (issue #9 acceptance criteria).
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS;
}

/**
 * Aggregate Observer word selections into the equal-weight "others" profile.
 *
 * Returns a normalized 0–1 score for every tribe in canonical (tribe `number`)
 * order — the same shape and ordering as `score`, so the result drops straight
 * into `rankScores` and the result view. With no responses it returns an
 * all-zero table (still all twelve tribes, canonical order), which the locked
 * state renders against.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  // A canonical, all-zero table: twelve tribes in `number` order. Doubles as
  // the empty-input result and as the accumulator's shape.
  const zeroed = score([]);
  if (responses.length === 0) return zeroed;

  const sums = new Map(zeroed.map((tribe) => [tribe.slug, 0]));
  for (const response of responses) {
    // Score each Observer on their own, then fold in their normalized profile.
    // Matching by slug keeps us independent of score()'s ordering.
    for (const tribe of score(response)) {
      sums.set(tribe.slug, sums.get(tribe.slug)! + tribe.score);
    }
  }

  return zeroed.map((tribe) => ({
    ...tribe,
    score: sums.get(tribe.slug)! / responses.length,
  }));
}
