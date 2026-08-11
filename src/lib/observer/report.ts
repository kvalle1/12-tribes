import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers, MIN_OBSERVERS } from "./aggregate";

/**
 * The self-vs-others comparison report that closes the 360 loop (issue #9,
 * ADR-0003). Pure and server-only: it composes the Subject's own Strength
 * Profile and the equal-weight aggregated "others" profile into one view model,
 * and gates the whole thing behind the ≥3-Observer unlock so no individual
 * Observer is exposed before the aggregate is meaningful and anonymous.
 *
 * Everything the report view needs is precomputed here on the server (scores,
 * per-tribe gaps, the sorted comparison, the anonymous per-Observer profiles) so
 * the view stays a dumb renderer and the word→tribe mapping never crosses the
 * trust boundary (ADR-0009).
 */

/** One anonymous Observer's individually-normalized profile, for drill-down. */
export interface ObserverProfile {
  /** 1-based label index only — "Observer 1", "Observer 2" — never an identity. */
  index: number;
  scores: TribeScore[];
}

/** Self vs aggregated-others for a single tribe. */
export interface TribeComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized score (0–1). */
  selfScore: number;
  /** The equal-weight "others" normalized score (0–1). */
  othersScore: number;
  /** self − others: positive ⇒ you rate yourself higher than others do. */
  gap: number;
}

export interface ComparisonReport {
  observerCount: number;
  /** True once at least MIN_OBSERVERS Observers have responded. */
  unlocked: boolean;
  /** Observers still needed to unlock (0 once unlocked). */
  remaining: number;
  /** The Subject's own Strength Profile, canonical order. */
  self: TribeScore[];
  /**
   * The aggregated equal-weight "others" profile, canonical order. All zeros
   * until unlocked — no Observer data is surfaced below the threshold.
   */
  others: TribeScore[];
  /**
   * Per-tribe self-vs-others rows, sorted strongest-first by the larger of the
   * two scores. Empty until unlocked.
   */
  comparison: TribeComparison[];
  /** Anonymous per-Observer profiles for drill-down. Empty until unlocked. */
  observers: ObserverProfile[];
}

/**
 * Build the comparison report from the Subject's own selected words and the list
 * of Observer word selections. The "others" aggregate, per-tribe comparison, and
 * per-Observer drill-down are computed only once unlocked (≥ MIN_OBSERVERS); below
 * the threshold the report carries just the count and the Subject's own profile,
 * so the locked view can show progress without leaking any Observer's answer.
 */
export function buildComparisonReport(
  selfWords: readonly string[],
  observerWordLists: readonly (readonly string[])[],
): ComparisonReport {
  const observerCount = observerWordLists.length;
  const unlocked = observerCount >= MIN_OBSERVERS;

  const self = score(selfWords);
  // Pass an empty list while locked so no sub-threshold aggregate is computed.
  const others = aggregateObservers(unlocked ? observerWordLists : []);

  const comparison: TribeComparison[] = unlocked
    ? self
        .map((s) => {
          const o = others.find((x) => x.slug === s.slug)!;
          return {
            slug: s.slug,
            name: s.name,
            selfScore: s.score,
            othersScore: o.score,
            gap: s.score - o.score,
          };
        })
        // Strongest-first by whichever side scores higher; ties keep canonical order.
        .sort(
          (a, b) =>
            Math.max(b.selfScore, b.othersScore) -
            Math.max(a.selfScore, a.othersScore),
        )
    : [];

  const observers: ObserverProfile[] = unlocked
    ? observerWordLists.map((words, i) => ({
        index: i + 1,
        scores: score(words),
      }))
    : [];

  return {
    observerCount,
    unlocked,
    remaining: Math.max(0, MIN_OBSERVERS - observerCount),
    self,
    others,
    comparison,
    observers,
  };
}
