import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pairs a Subject's own profile against the equal-weight "others" profile
 * (`aggregate.ts`) for the 360 comparison report (issue #9). Pure display math:
 * no scoring and no `server-only` imports, so the report component can call it
 * directly. Both inputs are already normalized to the same 0–1 scale, so a
 * tribe's `self` and `others` scores are directly comparable.
 */

/**
 * A tribe counts as a point of divergence when the gap between how the Subject
 * sees themselves and how others see them is at least this fraction of the
 * strongest signal in the whole comparison. Expressing the threshold relative to
 * the shared peak keeps it meaningful whether the two profiles are broadly
 * strong or broadly faint.
 */
export const DIVERGENCE_THRESHOLD = 0.33;

/**
 * A tribe only counts as a point of *agreement* when both reads place it at
 * least this fraction of the strongest signal — otherwise a tribe both sides
 * barely registered (a stray shared word) could be announced as something "you
 * both see strongly," which would be misleading.
 */
export const AGREEMENT_THRESHOLD = 0.5;

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /** Signed gap, `others - self`: positive ⇒ others see it more strongly. */
  gap: number;
  /** `self` as a fraction of the shared peak, for a bar drawn on a common scale. */
  selfRelative: number;
  /** `others` as a fraction of the shared peak, on the same common scale. */
  othersRelative: number;
  /** Whether the gap is large enough (relative to the shared peak) to flag. */
  divergent: boolean;
}

export interface ProfileComparison {
  /** Every tribe, ranked by the stronger of the two reads; canonical tie-break. */
  rows: ComparisonRow[];
  /**
   * The tribe the Subject and others most agree is strong — the highest shared
   * floor (`min(self, others)`) among tribes that clear `AGREEMENT_THRESHOLD`.
   * Undefined when no tribe is seen strongly by both.
   */
  topAgreement?: ComparisonRow;
  /**
   * The sharpest point of divergence — the largest absolute gap among flagged
   * rows. Undefined when the two reads never diverge enough to flag.
   */
  topDivergence?: ComparisonRow;
}

/**
 * Build the paired self-vs-others comparison. `self` and `others` are canonical
 * `TribeScore[]` (one entry per tribe); rows are matched by `slug` so ordering
 * of the inputs doesn't matter. Rows come back ranked by the stronger of the two
 * reads so the tribes that matter to either side surface first, with ties
 * holding canonical order (the sort is stable over canonically-ordered input).
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const sharedMax = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  const rows: ComparisonRow[] = self.map((s) => {
    const selfScore = s.score;
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    const gap = othersScore - selfScore;
    return {
      slug: s.slug,
      name: s.name,
      self: selfScore,
      others: othersScore,
      gap,
      selfRelative: sharedMax > 0 ? selfScore / sharedMax : 0,
      othersRelative: sharedMax > 0 ? othersScore / sharedMax : 0,
      divergent: sharedMax > 0 && Math.abs(gap) / sharedMax >= DIVERGENCE_THRESHOLD,
    };
  });

  // Stable sort by the stronger read, so ties keep canonical order.
  const ranked = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  const topAgreement =
    sharedMax > 0
      ? rows
          .filter(
            (r) => Math.min(r.self, r.others) / sharedMax >= AGREEMENT_THRESHOLD,
          )
          .sort(
            (a, b) => Math.min(b.self, b.others) - Math.min(a.self, a.others),
          )[0]
      : undefined;

  const topDivergence = rows
    .filter((r) => r.divergent)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];

  return { rows: ranked, topAgreement, topDivergence };
}
