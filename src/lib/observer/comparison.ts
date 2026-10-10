import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure display shaping for the self-vs-others comparison report (issue #9).
 * Pairs the Subject's own profile with the aggregated "others" profile per
 * tribe and prepares the data the report view maps over — ranking, the gap
 * between the two reads, and bar-fill fractions on a shared scale.
 *
 * Client-safe and dependency-free (operates on already-computed `TribeScore[]`,
 * no scoring, no `server-only` imports), mirroring `ranking.ts`, so it can be
 * unit-tested and imported anywhere.
 */

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  selfScore: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  othersScore: number;
  /**
   * `othersScore - selfScore`. Positive means others see this tribe in the
   * Subject more strongly than the Subject sees it in themselves (a blind
   * spot); negative means the reverse. The gap is where the 360 insight lives.
   */
  gap: number;
  /** 0–1 self bar-fill, relative to the max score across *both* series. */
  selfRelative: number;
  /** 0–1 others bar-fill, relative to that same shared max. */
  othersRelative: number;
}

/**
 * Pair self and others scores into comparison rows, ranked by the stronger of
 * the two scores (highest first) so the most salient tribes lead. Ties keep
 * canonical (tribe `number`) order, matching the deterministic ordering used
 * elsewhere. Both bars are scaled against a single shared maximum so the two
 * series are directly readable against each other. Neither input is mutated.
 *
 * `self` and `others` are expected to cover the same tribes (both come from the
 * 12-tribe scoring core); `others` is matched to `self` by slug.
 */
export function buildComparison(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const paired = self.map((selfScore) => {
    const othersScore = othersBySlug.get(selfScore.slug) ?? 0;
    return {
      slug: selfScore.slug,
      name: selfScore.name,
      selfScore: selfScore.score,
      othersScore,
      gap: othersScore - selfScore.score,
    };
  });

  const sharedMax = paired.reduce(
    (max, row) => Math.max(max, row.selfScore, row.othersScore),
    0,
  );

  return paired
    .map((row) => ({
      ...row,
      selfRelative: sharedMax > 0 ? row.selfScore / sharedMax : 0,
      othersRelative: sharedMax > 0 ? row.othersScore / sharedMax : 0,
    }))
    .sort(
      (a, b) =>
        Math.max(b.selfScore, b.othersScore) -
        Math.max(a.selfScore, a.othersScore),
    );
}
