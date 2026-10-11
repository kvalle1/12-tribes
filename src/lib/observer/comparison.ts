import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure shaping for the self-vs-others comparison report (issue #9). Takes two
 * already-computed normalized profiles — the Subject's own Self scores and the
 * equal-weight "others" average from `aggregateObservers` — and produces the
 * per-tribe rows the report renders.
 *
 * Type-only import of `TribeScore`, so this module is client-safe: it carries no
 * scoring logic and no word→tribe mapping, only arithmetic over scores already
 * computed server-side.
 */

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /** others − self: positive means others see this tribe more strongly than the Subject does. */
  gap: number;
  /** Bar-fill fraction for the self bar, on a scale shared with `othersRelative`. */
  selfRelative: number;
  /** Bar-fill fraction for the others bar, on the same shared scale. */
  othersRelative: number;
}

/**
 * Build the comparison rows, highest-first by the stronger of the two sides so
 * the tribes that matter in *either* view rise to the top. Ranking ties keep the
 * input's canonical (tribe `number`) order, matching the deterministic ordering
 * used elsewhere. Both bars share one scale (the single largest score across
 * both profiles) so the self and others bars are directly comparable rather than
 * each normalized to its own max. Inputs are not mutated.
 */
export function buildComparison(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // One shared scale across both profiles, so a self bar and an others bar of the
  // same length mean the same score.
  const max = self.reduce(
    (acc, s) => Math.max(acc, s.score, othersBySlug.get(s.slug) ?? 0),
    0,
  );
  const relative = (value: number) => (max > 0 ? value / max : 0);

  const rows: ComparisonRow[] = self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersScore,
      gap: othersScore - s.score,
      selfRelative: relative(s.score),
      othersRelative: relative(othersScore),
    };
  });

  // Stable sort by the stronger side desc; ties keep canonical input order.
  return rows.sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );
}
