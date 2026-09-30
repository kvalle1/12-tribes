import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). This is the "how others see you" half of the comparison report.
 *
 * The rule that matters: each Observer is scored **individually** with the same
 * normalized scoring core as the Self Assessment, and the "others" profile is the
 * plain average of those per-observer profiles — one vote each. An Observer who
 * selects more words does **not** gain more influence, because we never pool the
 * words into one bag and score them together (which would let a wordy observer
 * dominate). Averaging individually-normalized profiles keeps effort (word count)
 * from becoming influence.
 *
 * Pure and dependency-free of the DB (it takes the already-loaded word lists), so
 * its external behavior is unit-testable without a datastore. It does use the
 * `server-only` scoring core, so it runs server-side only — same trust boundary
 * as the rest of scoring (ADR-0009).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003) — enough for the average to mean something and to keep any
 * single Observer anonymous within the group.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function hasEnoughObservers(count: number): boolean {
  return count >= OBSERVER_UNLOCK_THRESHOLD;
}

/**
 * One Observer's individually-scored profile. Deliberately anonymous: it carries
 * only a 1-based display `index` (Observer 1, 2, 3…) and their normalized scores —
 * never a name, relationship, or anything linking back to who they are.
 */
export interface ObserverProfile {
  /** 1-based anonymous label, in input (response) order. */
  index: number;
  /** This Observer's normalized per-tribe scores, in canonical tribe order. */
  scores: TribeScore[];
}

export interface ObserverAggregate {
  /** How many Observer responses were aggregated. */
  count: number;
  /**
   * The equal-weight average "others" profile: for each tribe, the mean of every
   * Observer's normalized score for that tribe. Canonical (tribe number) order.
   * All zero when there are no Observers.
   */
  average: TribeScore[];
  /** Each Observer scored on their own, for the anonymous per-observer drill-down. */
  observers: ObserverProfile[];
}

/**
 * Score each Observer's word selection individually, then return the equal-weight
 * average per-tribe "others" profile plus the per-observer breakdown. Input is a
 * list of word selections (one per Observer); it is not mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const observers: ObserverProfile[] = responses.map((words, i) => ({
    index: i + 1,
    scores: score(words),
  }));

  const average: TribeScore[] = tribes.map((tribe) => {
    const total = observers.reduce(
      (sum, observer) =>
        sum + (observer.scores.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observers.length > 0 ? total / observers.length : 0,
    };
  });

  return { count: observers.length, average, observers };
}
