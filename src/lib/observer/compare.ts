import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure self-vs-others comparison for the 360 report (issue #9). It lines the
 * Subject's own Strength Profile up against the equal-weight "others" profile
 * from {@link aggregateObservers} and surfaces where the two agree and where
 * they diverge.
 *
 * No scoring and no server-only imports: it consumes two already-computed
 * `TribeScore[]` arrays, so it is client-safe and unit-testable on its own, and
 * the report view can call it directly.
 */

export interface TribeComparison extends TribeScore {
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /**
   * `others - self`. Positive ⇒ others see this tribe in the Subject more than
   * they see it in themselves; negative ⇒ the Subject sees it in themselves more
   * than others do.
   */
  delta: number;
}

export interface ProfileComparison {
  /** Per-tribe comparison rows, ordered by the Subject's own score (desc). */
  tribes: TribeComparison[];
  /**
   * The tribe self and others agree on most strongly — the smallest gap among
   * tribes where at least one side has real signal. `null` only when neither
   * side scored anything.
   */
  strongestAgreement: TribeComparison | null;
  /** The tribe with the largest gap in either direction, or `null` if no gap. */
  largestDivergence: TribeComparison | null;
}

/**
 * Build the per-tribe comparison between a Subject's own profile and the
 * aggregated "others" profile. Both inputs are expected in the same canonical
 * order `score` produces; rows are matched by slug regardless, then re-ordered
 * by the Subject's own score (ties keep canonical order, matching the rest of
 * the app's deterministic ranking).
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const rows: TribeComparison[] = self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      score: s.score,
      self: s.score,
      others: othersScore,
      delta: othersScore - s.score,
    };
  });

  // Order by the Subject's own score, highest first; ties keep canonical order.
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.self - a.row.self || a.index - b.index)
    .map(({ row }) => row);

  // Agreement/divergence only consider tribes with real signal on either side,
  // so an all-zero tribe both sides ignore is never called "strong agreement".
  const withSignal = ordered.filter((r) => r.self > 0 || r.others > 0);

  const strongestAgreement =
    withSignal.length > 0
      ? withSignal.reduce((best, r) =>
          Math.abs(r.delta) < Math.abs(best.delta) ? r : best,
        )
      : null;

  const largestDivergence =
    withSignal.length > 0
      ? withSignal.reduce((worst, r) =>
          Math.abs(r.delta) > Math.abs(worst.delta) ? r : worst,
        )
      : null;

  return {
    tribes: ordered,
    strongestAgreement,
    largestDivergence:
      largestDivergence && largestDivergence.delta !== 0
        ? largestDivergence
        : null,
  };
}
