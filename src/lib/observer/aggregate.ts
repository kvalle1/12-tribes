import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). This is the pure counterpart to the Self scoring core: given the
 * Observer responses for one Subject, it scores each Observer *individually*
 * with the same normalized `score()` core, then returns the **equal-weight
 * average** per-tribe "others" profile.
 *
 * Averaging each Observer's already-normalized scores — rather than pooling all
 * their words into one bag and scoring that — is the whole point: an Observer
 * who selects more words must not gain more influence over the result. Pooling
 * would let word count become influence; equal-weight averaging gives every
 * Observer exactly one vote.
 *
 * Reuses the Self scoring core unchanged, so "others" scores are directly
 * comparable to the Subject's own in the comparison report. The core is
 * `server-only`, so this module is too — aggregation runs on the server and the
 * word→tribe mapping never reaches the client (ADR-0009).
 */

/** The minimum number of Observer responses before the comparison report unlocks. */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** An Observer response reduced to the only thing aggregation needs: its words. */
export interface ObserverWords {
  readonly words: string[];
}

/**
 * Whether the self-vs-others comparison report may be shown. It unlocks only
 * once at least `MIN_OBSERVERS_TO_UNLOCK` Observers have responded, which makes
 * the average meaningful and preserves each Observer's anonymity in aggregate
 * (ADR-0003).
 */
export function isComparisonUnlocked(responseCount: number): boolean {
  return responseCount >= MIN_OBSERVERS_TO_UNLOCK;
}

/**
 * Score each Observer response individually with the normalized Self core,
 * preserving input order. Each entry is a full canonical-order `TribeScore[]`,
 * independently normalized — the raw material both for the equal-weight average
 * and for the anonymous per-observer drill-down (Observer 1 / 2 / 3).
 */
export function scoreEachObserver(
  responses: readonly ObserverWords[],
): TribeScore[][] {
  return responses.map((response) => score(response.words));
}

/**
 * The equal-weight "others" profile: the mean, per tribe, of each Observer's
 * individually-normalized score. Returns a `TribeScore[]` in canonical (tribe
 * `number`) order — the same shape the Self core returns — so the comparison
 * report can line the two profiles up tribe-for-tribe. With no responses every
 * tribe scores 0.
 */
export function aggregateObservers(
  responses: readonly ObserverWords[],
): TribeScore[] {
  const perObserver = scoreEachObserver(responses);
  const count = perObserver.length;

  return tribes.map((tribe) => {
    let sum = 0;
    for (const observerScores of perObserver) {
      const match = observerScores.find((s) => s.slug === tribe.slug);
      sum += match ? match.score : 0;
    }
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? sum / count : 0,
    };
  });
}
