import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into a single
 * "how others see you" profile (issue #9, ADR-0003).
 *
 * Each Observer is scored individually with the same normalized scoring core the
 * Self flow uses, then we take the plain mean of those per-observer profiles —
 * NOT a pooled bag of every observer's words. Averaging already-normalized
 * profiles means an Observer who selects more words gains no extra influence:
 * every Observer counts exactly once. This is `server-only` only because the
 * scoring core it reuses carries the word→tribe mapping (ADR-0009 trust
 * boundary); the aggregation itself is pure.
 */

/**
 * The minimum number of Observers required before the comparison report
 * unlocks (ADR-0003). Below this the average isn't meaningful and individual
 * anonymity is weaker, so the report stays locked.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/** One Observer's anonymous selection — just the words, never their identity. */
export interface ObserverResponse {
  words: readonly string[];
}

export interface AggregatedObservers {
  /** How many Observer responses went into the average. */
  observerCount: number;
  /** Equal-weight average per-tribe profile, canonical (tribe `number`) order. */
  scores: TribeScore[];
  /**
   * Each Observer's own normalized profile, in input order. Backs the anonymous
   * "Observer 1/2/3" drill-down — carries no identity, only the scored words.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile. Scores
 * each Observer independently (normalized, same core as the Self flow) and
 * returns the per-tribe mean across Observers, plus every Observer's own profile
 * for the anonymous drill-down. With no Observers the profile is all-zero and no
 * division by zero occurs.
 */
export function aggregateObservers(
  responses: readonly ObserverResponse[],
): AggregatedObservers {
  const perObserver = responses.map((r) => score(r.words));
  const observerCount = perObserver.length;

  const scores: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, table) =>
        sum + (table.find((t) => t.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, scores, perObserver };
}

/** A tribe's self score alongside the aggregated "others" score. */
export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight average of Observers' normalized scores for this tribe. */
  others: number;
  /** `others − self`: positive means Observers rate this tribe higher than you do. */
  delta: number;
}

/**
 * Pair a Subject's own profile against the aggregated "others" profile, tribe by
 * tribe, in canonical order. `delta` (others − self) is the signed gap the
 * report highlights: where the two reads align (near zero) and where they
 * diverge (large magnitude). Pure and order-preserving; inputs are not mutated.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  return tribes.map((tribe) => {
    const selfScore = self.find((s) => s.slug === tribe.slug)?.score ?? 0;
    const othersScore = others.find((s) => s.slug === tribe.slug)?.score ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      self: selfScore,
      others: othersScore,
      delta: othersScore - selfScore,
    };
  });
}
