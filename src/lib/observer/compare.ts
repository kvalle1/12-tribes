import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pair a Subject's Self profile against the aggregated "others" profile, tribe by
 * tribe, for the 360 comparison report (issue #9). Both inputs are on the same
 * normalized 0–1 scale (Self from the scoring core, others from the equal-weight
 * `aggregateObservers` average), so `gap` is a meaningful like-for-like
 * difference.
 *
 * Pure and client-safe: it takes only already-computed scores and imports a type,
 * never the `server-only` scoring core, so the render layer can call it freely.
 */

export interface ComparisonRow {
  slug: string;
  name: string;
  /** Self normalized score, 0–1. */
  selfScore: number;
  /** Equal-weight "others" normalized score, 0–1. */
  othersScore: number;
  /**
   * `othersScore − selfScore`. Positive: others see the trait in you more than
   * you claim it (a blind spot / hidden strength). Negative: you claim it more
   * than others see it. Near zero: you and they agree.
   */
  gap: number;
}

/**
 * Build one comparison row per tribe, sorted by the larger of the two scores so
 * the most salient tribes (whether you or others surface them) come first. Ties
 * keep canonical tribe order — the input order of `self` — so the ordering is
 * deterministic. Neither input is mutated.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  return self
    .map((s) => {
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        selfScore: s.score,
        othersScore,
        gap: othersScore - s.score,
      };
    })
    .sort(
      (a, b) =>
        Math.max(b.selfScore, b.othersScore) -
        Math.max(a.selfScore, a.othersScore),
    );
}

/**
 * The largest bar value across both profiles — the common denominator the report
 * scales every bar against, so Self and others bars share one honest scale (a
 * bigger "others" bar really means a higher score, not just a different max).
 * Returns 0 only when nothing scored.
 */
export function comparisonScale(rows: readonly ComparisonRow[]): number {
  return rows.reduce(
    (max, row) => Math.max(max, row.selfScore, row.othersScore),
    0,
  );
}
