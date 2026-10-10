import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure, client-safe shaping for the self-vs-others comparison report (issue #9).
 * It takes two already-computed normalized profiles — the Subject's own scores
 * and the equal-weight aggregated "others" scores (from `aggregateObservers`) —
 * and turns them into display rows. It carries no scoring and no word→tribe
 * mapping (only a type-only import of the score shape), so the view can import
 * it without pulling the server-only scoring core into the client (ADR-0009).
 */

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  selfScore: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  othersScore: number;
  /**
   * `selfScore - othersScore`. Positive ⇒ the Subject reads this tribe in
   * themselves more strongly than others do; negative ⇒ others see it more than
   * the Subject does (a potential blind spot).
   */
  gap: number;
  /** Bar-fill fraction for the self score, relative to the shared max. */
  selfRelative: number;
  /** Bar-fill fraction for the others score, relative to the shared max. */
  othersRelative: number;
}

/**
 * Build the comparison rows, one per tribe, ordered by the stronger of the two
 * reads (highest first) so the tribes that matter to either side rise to the
 * top. Both bars are drawn against a single shared maximum (the largest score
 * in either profile) so the self and others bars are directly, honestly
 * comparable on one axis. Ties keep the input's canonical (tribe `number`)
 * order. Inputs are matched by slug and never mutated.
 */
export function buildComparison(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const max = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  const rows: ComparisonRow[] = self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      selfScore: s.score,
      othersScore,
      gap: s.score - othersScore,
      selfRelative: max > 0 ? s.score / max : 0,
      othersRelative: max > 0 ? othersScore / max : 0,
    };
  });

  // Stable sort by the stronger read desc; ties keep canonical input order.
  return rows.sort(
    (a, b) =>
      Math.max(b.selfScore, b.othersScore) - Math.max(a.selfScore, a.othersScore),
  );
}

/**
 * The tribes where the Subject's own read and the aggregated others read diverge
 * the most, largest absolute gap first, limited to `limit`. Rows where either
 * side scored something are considered; a perfectly aligned pair (gap 0) is
 * never surfaced. Used to headline "where reads diverge" in the report.
 */
export function topDivergences(
  rows: readonly ComparisonRow[],
  limit = 3,
): ComparisonRow[] {
  return [...rows]
    .filter((r) => r.gap !== 0)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, limit);
}
