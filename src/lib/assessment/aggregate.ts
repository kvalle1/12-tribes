import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 observer aggregation (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the **equal-weight average of each
 * observer's individually-normalized tribe scores** — not a pooled bag of words.
 * Each observer is scored on their own with the same pure core the Self flow uses
 * (`score`, ADR-0001), so their selection is already normalized to a 0–1 value
 * per tribe; we then average those profiles tribe-by-tribe. Averaging per-observer
 * profiles (rather than summing everyone's words) is what keeps influence equal:
 * an observer who picks more words raises their own normalized scores but never
 * counts for more than one voice in the average.
 *
 * Like the scoring core it builds on, this module is `server-only` so the
 * word→tribe mapping (reached transitively through `score`) never ships to the
 * client; the comparison page renders it server-side and hands the client only
 * plain, already-scored numbers.
 */

/** Observers required before the comparison report unlocks (ADR-0003). */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** Whether enough observers have responded for the comparison to be meaningful. */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_TO_UNLOCK;
}

export interface ObserverAggregate {
  /** How many observers contributed to the aggregate. */
  observerCount: number;
  /**
   * The equal-weight average normalized profile across all observers, one entry
   * per tribe in canonical (tribe `number`) order. All-zero when there are no
   * observers.
   */
  others: TribeScore[];
  /**
   * Each observer's individual normalized profile, in input order, for the
   * anonymous per-observer drill-down (Observer 1/2/3…). Each inner array is in
   * the same canonical tribe order as `others`.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a set of observer word-selections into an equal-weight "others"
 * profile. Each observer's words are scored independently (normalized per tribe),
 * then averaged tribe-by-tribe with equal weight. Returns the aggregate profile,
 * every observer's individual profile (input order, for drill-down), and the
 * observer count. An empty set yields an all-zero profile and no observers.
 */
export function aggregateObservers(
  observerSelections: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = observerSelections.map((words) => score(words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, profile) => sum + profile[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, others, perObserver };
}

/** A single tribe's self-vs-others comparison, on the shared normalized scale. */
export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /**
   * Signed gap, `self − others`: positive means the Subject sees more of this
   * tribe in themselves than others do; negative means others see more than the
   * Subject does.
   */
  gap: number;
}

export interface SelfVsOthers {
  /** Per-tribe comparison in canonical (tribe `number`) order. */
  rows: ComparisonRow[];
  /** The same rows re-sorted by gap magnitude, largest divergence first. */
  divergences: ComparisonRow[];
}

/**
 * Pair a Subject's own profile with the aggregated "others" profile tribe-by-tribe
 * on the shared normalized scale, exposing the signed gap per tribe. Both inputs
 * must be in canonical tribe order (as produced by `score` / `aggregateObservers`).
 * `divergences` is a convenience re-sort of the same rows by gap magnitude so the
 * report can surface where self and others agree and disagree most sharply. Ties
 * keep canonical order (the sort is stable). Neither input is mutated.
 */
export function compareSelfToOthers(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): SelfVsOthers {
  const rows: ComparisonRow[] = self.map((s, i) => {
    const o = others[i];
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: o.score,
      gap: s.score - o.score,
    };
  });

  const divergences = [...rows].sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
  );

  return { rows, divergences };
}
