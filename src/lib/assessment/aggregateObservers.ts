import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "others" profile is the **equal-weight average of each Observer's
 * individually-normalized Tribe scores** — one vote per Observer — not a pooled
 * bag of everyone's words. Scoring each Observer on their own first, then
 * averaging, means a wordier Observer gains no extra influence: whether someone
 * picks 8 words or 15, their read counts exactly as much as anyone else's. This
 * is the whole point of ADR-0003, and pooling would quietly break it (an
 * Observer who picks more words would push more raw points into the bag).
 *
 * Pure and reused verbatim from the shared scoring core, so the "others" numbers
 * are directly comparable to the Subject's own Self Assessment scores. Kept
 * `server-only` because it pulls in the word→tribe mapping via `score`
 * (ADR-0009 trust boundary).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — so the "others" view is meaningful in aggregate and no single
 * Observer can be singled out from the anonymous drill-down (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

/** Whether the comparison report is unlocked for the given Observer count. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Score each Observer response individually with the shared normalized core,
 * returning one 12-tribe score table per Observer, in the order given. The
 * caller loads responses oldest-first so the positional index is a stable,
 * anonymous "Observer N" label (issue #8 stores no Observer identity to use
 * instead).
 */
export function scoreEachObserver(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[][] {
  return observerWordLists.map((words) => score(words));
}

/**
 * Aggregate Observer responses into a single "others" profile: for every tribe,
 * the equal-weight mean of the Observers' individually-normalized scores. With
 * no responses, every tribe is 0. Returns all 12 tribes in canonical (tribe
 * `number`) order, matching `score`.
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = scoreEachObserver(observerWordLists);
  const n = perObserver.length;

  return tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, table) =>
        sum + (table.find((t) => t.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: n > 0 ? total / n : 0,
    };
  });
}

/** A tribe's Self score alongside the aggregated "others" score, and the gap. */
export interface ProfileComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" score for this tribe. */
  others: number;
  /**
   * `self − others`: positive where the Subject sees the tribe in themselves
   * more strongly than others do, negative where others see it more strongly.
   * The largest-magnitude gaps are where the most useful insight lives.
   */
  divergence: number;
}

/**
 * Line up a Self profile against an "others" profile tribe-by-tribe, so the
 * report can show them side by side and surface where they most diverge. Both
 * inputs are 12-tribe normalized score tables (Self from `score`, others from
 * `aggregateObservers`); the result is in canonical tribe order.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison[] {
  return tribes.map((tribe) => {
    const s = self.find((t) => t.slug === tribe.slug)?.score ?? 0;
    const o = others.find((t) => t.slug === tribe.slug)?.score ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      self: s,
      others: o,
      divergence: s - o,
    };
  });
}
