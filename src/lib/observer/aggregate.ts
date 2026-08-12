import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored with the *same* normalized core the
 * Self flow uses (`score`), producing a per-observer Strength Profile on the
 * shared 0–1 scale. The "others" profile is the **equal-weight average** of
 * those per-observer profiles: every Observer contributes exactly `1/n`,
 * independent of how many words they picked. Because each observer is scored and
 * normalized *before* averaging — rather than pooling everyone's words into one
 * bag — a chatty observer who selects fifteen words gains no more sway than one
 * who selects eight.
 *
 * Kept server-only (it imports the `server-only` scoring core, which carries the
 * word→tribe mapping) and dependency-free so it can be unit-tested against word
 * lists without a database.
 */

/**
 * How many Observer responses must exist before the comparison report unlocks.
 * Below this the aggregate is statistically thin and, with few responses, less
 * anonymous — so the report stays locked until the floor is met.
 */
export const MIN_OBSERVERS = 3;

/** Whether the comparison report is unlocked for a Subject with `count` responses. */
export function isComparisonUnlocked(count: number): boolean {
  return count >= MIN_OBSERVERS;
}

export interface ObserverAggregate {
  /** How many Observer responses fed this aggregate. */
  observerCount: number;
  /**
   * Equal-weight average normalized score per tribe, in canonical (tribe
   * `number`) order — the "others" Strength Profile.
   */
  scores: TribeScore[];
  /**
   * Each Observer's own normalized profile, in input order. Anonymous by
   * construction: an entry is identified only by its position (Observer 1, 2,
   * …), never by who submitted it.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile. `responses` is one entry per Observer, each the words that Observer
 * selected. Returns an all-zero profile (and a zero count) for no responses.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const n = perObserver.length;

  const scores: TribeScore[] = tribes.map((tribe, i) => ({
    slug: tribe.slug,
    name: tribe.name,
    score:
      n > 0 ? perObserver.reduce((sum, p) => sum + p[i].score, 0) / n : 0,
  }));

  return { observerCount: n, scores, perObserver };
}
