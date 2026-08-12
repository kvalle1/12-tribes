import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure self-vs-others comparison for the 360 report (issue #9). Given the
 * Subject's own Strength Profile and the aggregated "others" profile — both on
 * the shared normalized 0–1 scale — it produces per-tribe rows the comparison
 * view draws two bars from, and flags where the two reads diverge.
 *
 * Client-safe: it imports only the `TribeScore` *type* (erased at build), never
 * the server-only scoring core, so a client component could render from its
 * output if needed.
 */

/**
 * How far apart the self and others bars must sit — as a fraction of the shared
 * bar scale — before a tribe counts as a divergence worth highlighting. A gap of
 * ~a third of the top bar reads as "they clearly see this differently."
 */
export const DIVERGENCE_THRESHOLD = 0.33;

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe (0–1). */
  selfScore: number;
  /** The aggregated others' normalized score for this tribe (0–1). */
  othersScore: number;
  /** Self bar fill, as a fraction of the shared max across both profiles. */
  selfFraction: number;
  /** Others bar fill, as a fraction of the shared max across both profiles. */
  othersFraction: number;
  /** Absolute gap between the two fractions (0–1). */
  gap: number;
  /** Whether the gap crosses {@link DIVERGENCE_THRESHOLD}. */
  diverges: boolean;
}

/**
 * Build the comparison rows. Self and others are paired by slug (order-agnostic),
 * both bars are scaled against one shared maximum so the two profiles are
 * directly comparable, and rows are sorted by the stronger of the two bars so the
 * tribes that matter to *either* read surface first. Ties keep the self profile's
 * incoming (canonical) order.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o]));

  const max = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((o) => o.score),
  );
  const fraction = (value: number) => (max > 0 ? value / max : 0);

  const rows: ComparisonRow[] = self.map((s) => {
    const othersScore = othersBySlug.get(s.slug)?.score ?? 0;
    const selfFraction = fraction(s.score);
    const othersFraction = fraction(othersScore);
    const gap = Math.abs(selfFraction - othersFraction);
    return {
      slug: s.slug,
      name: s.name,
      selfScore: s.score,
      othersScore,
      selfFraction,
      othersFraction,
      gap,
      diverges: gap >= DIVERGENCE_THRESHOLD,
    };
  });

  // Stable sort (canonical tie-break) by the stronger of the two bars.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const byStrength =
        Math.max(b.row.selfFraction, b.row.othersFraction) -
        Math.max(a.row.selfFraction, a.row.othersFraction);
      return byStrength !== 0 ? byStrength : a.index - b.index;
    })
    .map(({ row }) => row);
}
