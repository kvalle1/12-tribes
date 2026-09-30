import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). This is the "how others see you" half of the comparison report.
 *
 * The rule that matters: each Observer gets exactly **one vote of equal weight**,
 * no matter how many words they selected. To make that true we can't just average
 * the raw scoring-core profiles: the core normalizes each tribe by its coverage,
 * not by the observer's selection size, so a wordier observer's profile carries
 * more total mass — and averaging those is mathematically just pooling every
 * observer's words together and dividing by N (same shape a "bag of words" would
 * give, letting effort become influence).
 *
 * So each Observer's profile is scored with the shared core and then normalized to
 * **unit mass** (its tribe scores rescaled to sum to 1) before averaging. Every
 * observer then contributes the same total, and the "others" profile is the plain
 * mean of those unit-mass profiles — genuinely equal-weight, not a pooled bag.
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
  /** 1-based anonymous label, in input order. */
  index: number;
  /**
   * This Observer's per-tribe scores from the shared scoring core, in canonical
   * tribe order. These are the raw coverage-normalized scores (for the
   * per-observer drill-down, shown relative to the observer's own top tribe); the
   * equal-weight `average` rescales each observer to unit mass before combining.
   */
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

  // Rescale each observer's profile to unit mass so word count can't buy
  // influence, then average the unit-mass profiles — one equal vote each.
  const unitMass = observers.map((observer) => toUnitMass(observer.scores));

  const average: TribeScore[] = tribes.map((tribe, t) => {
    const total = unitMass.reduce((sum, profile) => sum + profile[t], 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: unitMass.length > 0 ? total / unitMass.length : 0,
    };
  });

  return { count: observers.length, average, observers };
}

/**
 * Rescale a per-tribe score vector so its entries sum to 1 (unit mass), returned
 * in canonical tribe order. An all-zero profile (no scoreable words) stays all
 * zero. This is what makes averaging equal-weight: every observer contributes the
 * same total mass regardless of how many words they picked.
 */
function toUnitMass(scores: TribeScore[]): number[] {
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  return scores.map((s) => (total > 0 ? s.score / total : 0));
}
