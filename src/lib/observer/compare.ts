import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pair a Subject's own profile against the aggregated "others" profile for the
 * comparison report (issue #9). Pure and client-safe — it takes two already-
 * computed canonical-order score vectors (self from `score`, others from
 * `aggregateObservers`) and aligns them tribe by tribe, so neither the scoring
 * core nor the word→tribe mapping needs to reach the view.
 *
 * Rows are ranked by the stronger of the two scores so the tribes that matter to
 * either view surface first, and each row carries the absolute `divergence`
 * between self and other — the gap that is the whole point of a 360 (where the
 * Subject and their Observers see them differently). Ties keep canonical order.
 */
export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  other: number;
  /** Absolute gap |self − other| — larger means more disagreement. */
  divergence: number;
}

export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const otherBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const rows: ComparisonRow[] = self.map((s) => {
    const other = otherBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      other,
      divergence: Math.abs(s.score - other),
    };
  });

  // Rank by the stronger of the two scores, highest first; a stable sort keeps
  // canonical (input) order for rows that tie.
  return rows.sort(
    (a, b) => Math.max(b.self, b.other) - Math.max(a.self, a.other),
  );
}
