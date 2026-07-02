import "server-only";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the **equal-weight average of each
 * Observer's individually-normalized tribe scores** — not a pooled bag of words.
 * Each Observer's selection is scored through the very same normalized scoring
 * core the Subject's Self Assessment uses (`score`), producing a 0–1 value per
 * tribe; those per-Observer profiles are then averaged with equal weight. This
 * is deliberate: an Observer who picks more words must not gain more influence
 * (a pooled-bag approach would let word count become sway), so effort never
 * becomes weight.
 *
 * The module is pure and dependency-free (beyond the scoring core it reuses),
 * so it can be unit-tested without a database and reused unchanged by the
 * comparison report. It is `server-only` because it pulls in `score`, which
 * imports the word→tribe mapping that must never reach the client (ADR-0009).
 */

/**
 * The minimum number of Observer responses before the comparison report unlocks
 * (ADR-0003). Below this the "others" average would be thin and individual
 * Observers would be too easy to single out; at three or more the aggregate is
 * meaningful and no single Observer is identifiable.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** Whether enough Observers have responded to reveal the comparison report. */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_TO_UNLOCK;
}

/**
 * Aggregate Observer responses into a single "others" profile: the equal-weight
 * average, per tribe, of each Observer's normalized score. Returns a score for
 * every tribe in canonical (tribe `number`) order — the same shape `score`
 * returns — so it feeds `rankScores` and the result view unchanged.
 *
 * Each entry in `responses` is one Observer's selected words. An empty list of
 * responses yields an all-zero profile (no divide-by-zero). The input is not
 * mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  // Canonical 12-tribe skeleton (all-zero) — `score([])` is the source of the
  // canonical slug/name ordering, so the output matches the Self profile shape.
  const canonical = score([]);
  const observerCount = responses.length;

  if (observerCount === 0) return canonical;

  const totals: Record<string, number> = {};
  for (const tribe of canonical) totals[tribe.slug] = 0;

  for (const words of responses) {
    for (const tribeScore of score(words)) {
      totals[tribeScore.slug] += tribeScore.score;
    }
  }

  return canonical.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: totals[tribe.slug] / observerCount,
  }));
}
