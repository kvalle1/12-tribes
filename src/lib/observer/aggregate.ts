import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses into an "others" profile
 * (issue #9, ADR-0003). This is the deep module that closes the 360 loop: it
 * turns many anonymous Observer word-selections into a single per-tribe profile
 * comparable to the Subject's own.
 *
 * The rule that matters is **equal weight per Observer**: each Observer's
 * selection is scored on its own with the shared Self scoring core (so it is
 * normalized to 0–1 per tribe), and the "others" profile is the plain average of
 * those per-Observer profiles. An Observer who picks more words therefore does
 * not gain more influence — pooling everyone's words into one bag would let a
 * heavy picker dominate, so we deliberately do not do that.
 *
 * Reusing `score` (the same core the Self flow uses) is what keeps observer and
 * self scores on the same scale, so the comparison report can put them side by
 * side honestly. Server-only, because `score` carries the word→tribe mapping
 * that must never reach the client (ADR-0009).
 */

/** The number of Observer responses required before the report unlocks (ADR-0003). */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/**
 * Whether the comparison report is unlocked for a Subject with `observerCount`
 * responses. Below the threshold the report stays locked so a single observer's
 * read can't stand in for the group's (ADR-0003).
 */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}

export interface ObserverAggregate {
  /**
   * The equal-weight average "others" profile — one normalized 0–1 score per
   * tribe, in canonical (tribe `number`) order, so it lines up with the Self
   * profile from `score`.
   */
  average: TribeScore[];
  /**
   * Each Observer's individual normalized profile, in input order (Observer 1,
   * Observer 2, …). Backs the anonymous per-observer drill-down.
   */
  perObserver: TribeScore[][];
  /** How many Observer responses were aggregated. */
  observerCount: number;
}

/**
 * Aggregate anonymous Observer word-selections into the equal-weight "others"
 * profile. Each element of `responses` is one Observer's selected words; they are
 * scored independently and averaged with equal weight per Observer. With no
 * responses the average is an all-zero profile (still every tribe, canonical
 * order) so callers can render a consistent shape before the report unlocks.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const average: TribeScore[] = tribes.map((tribe, index) => {
    const total = perObserver.reduce(
      (sum, profile) => sum + profile[index].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { average, perObserver, observerCount };
}
