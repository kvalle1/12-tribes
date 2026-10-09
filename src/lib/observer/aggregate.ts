import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * The equal-weight "others" aggregation that closes the 360 loop (issue #9,
 * ADR-0003). Server-only: it pulls in the scoring core (and so the word→tribe
 * mapping), which must never reach the client (ADR-0009 trust boundary).
 *
 * The comparison report unlocks only once at least this many Observers have
 * responded — enough for the average to mean something and to keep any single
 * Observer anonymous within the aggregate (ADR-0003).
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}

/**
 * The equal-weight "others" profile for a Subject (ADR-0003). Each Observer's
 * word selection is scored individually with the *same* normalized scoring core
 * the Self Assessment uses, then the per-Observer profiles are averaged
 * tribe-by-tribe — crucially **not** pooled into one bag of words.
 *
 * Averaging already-normalized per-Observer profiles means an Observer who picks
 * more words carries no more weight than one who picks fewer: effort never
 * becomes influence. (Pooling the words first would let a verbose Observer
 * dominate.) Because each Observer's profile is a normalized 0–1 score per tribe
 * and we take a plain mean, the "others" profile stays on the exact same 0–1
 * scale as a Self profile, so the two are directly comparable in the report.
 *
 * Returns a score for every tribe in canonical (tribe `number`) order — the same
 * shape `score` returns — so it drops straight into `rankScores` and the result
 * view. An empty input yields an all-zero profile.
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[] {
  const observerCount = observerWordLists.length;

  // Accumulate each Observer's normalized per-tribe score by slug, so the mean
  // is robust to ordering and reads as "sum of per-observer scores ÷ observers".
  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const words of observerWordLists) {
    for (const tribeScore of score(words)) {
      totals[tribeScore.slug] += tribeScore.score;
    }
  }

  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: observerCount > 0 ? totals[tribe.slug] / observerCount : 0,
  }));
}
