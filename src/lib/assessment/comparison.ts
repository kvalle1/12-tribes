import type { TribeScore } from "./score";

/**
 * Pure self-vs-others comparison (issue #9) — pairs a Subject's own normalized
 * profile against the aggregated "others" profile, tribe by tribe, so the
 * report can show them side by side and highlight where they align and where
 * they diverge. "The gap is where the most useful insight lives" (PRD #3).
 *
 * No scoring and no server-only imports: it takes already-computed score tables
 * in and returns plain data out, so it is trivially unit-testable and safe to
 * use from either a server or a client component.
 */

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /**
   * `others - self`: positive when others see the tribe in the Subject more
   * strongly than the Subject sees it themselves, negative when the reverse.
   */
  delta: number;
  /** `|delta|` — how far apart the two readings are, for ranking divergence. */
  divergence: number;
}

/**
 * Pair each tribe's self score with its others score, keeping canonical (tribe
 * `number`) order. Tribes present in one table but not the other are treated as
 * scoring 0 on the missing side, so the result always covers every tribe either
 * table mentions.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((t) => [t.slug, t]));
  const selfBySlug = new Map(self.map((t) => [t.slug, t]));

  // Canonical order follows the self table first, then any others-only tribes.
  const order: TribeScore[] = [
    ...self,
    ...others.filter((t) => !selfBySlug.has(t.slug)),
  ];

  return order.map((entry) => {
    const selfScore = selfBySlug.get(entry.slug)?.score ?? 0;
    const othersScore = othersBySlug.get(entry.slug)?.score ?? 0;
    const delta = othersScore - selfScore;
    return {
      slug: entry.slug,
      name: entry.name,
      self: selfScore,
      others: othersScore,
      delta,
      divergence: Math.abs(delta),
    };
  });
}

/**
 * The tribes where self and others diverge most, largest gap first — the
 * headline "here's where your read and theirs part ways" of the report. Ties in
 * divergence keep canonical order. Rows with no gap at all are dropped.
 */
export function largestDivergences(
  rows: readonly ComparisonRow[],
  limit = 3,
): ComparisonRow[] {
  return [...rows]
    .filter((r) => r.divergence > 0)
    .sort((a, b) => b.divergence - a.divergence)
    .slice(0, limit);
}
