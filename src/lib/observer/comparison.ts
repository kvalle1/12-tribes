import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure comparison math for the 360 report (issue #9): pair the Subject's own
 * profile against the aggregated "others" profile, tribe by tribe, and surface
 * where the two reads diverge — "the gap is where growth lives" (ADR-0003).
 *
 * Deliberately client-safe — no scoring, no word→tribe mapping, no `server-only`
 * import — so the report view can render these rows directly and the math is
 * unit-testable without the server boundary. Inputs are already-computed
 * `TribeScore[]` (self from the scoring core, others from `aggregateObservers`).
 */

/** Who reads a tribe more strongly. */
export type DivergenceDirection = "self-higher" | "others-higher";

/**
 * Gaps at or below this are treated as agreement, not divergence. Normalized
 * scores divide by fractional denominators, so two mathematically-equal reads
 * can differ by floating-point noise (~1e-17); without this, such a tribe could
 * be padded into the highlights and printed as a confident "others see more…".
 */
const DIVERGENCE_EPSILON = 1e-9;

export interface ComparisonRow extends TribeScore {
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /** `self - others`: positive means the Subject rates it higher than others do. */
  delta: number;
}

export interface Divergence extends ComparisonRow {
  /** Magnitude of the gap, `Math.abs(delta)`. */
  gap: number;
  direction: DivergenceDirection;
}

/**
 * Pair self and others per tribe, in canonical (tribe `number`) order. Tribes
 * are matched by slug, so the two inputs need not share an ordering; a tribe
 * missing from either side is treated as scoring 0 there.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // Drive off self's order (canonical, all twelve tribes) so the output is
  // complete and deterministic regardless of the inputs' ordering.
  return self.map((s) => {
    const selfScore = s.score;
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      score: selfScore,
      self: selfScore,
      others: othersScore,
      delta: selfScore - othersScore,
    };
  });
}

/**
 * The tribes where self and others diverge most, widest gap first. Rows where
 * the two agree exactly (zero gap) are dropped, and `direction` names who reads
 * the tribe more strongly. Pass `limit` to cap the number of highlights.
 */
export function divergences(
  rows: readonly ComparisonRow[],
  limit = rows.length,
): Divergence[] {
  return rows
    .filter((row) => Math.abs(row.delta) > DIVERGENCE_EPSILON)
    .map((row) => ({
      ...row,
      gap: Math.abs(row.delta),
      direction: (row.delta > 0
        ? "self-higher"
        : "others-higher") as DivergenceDirection,
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, limit);
}
