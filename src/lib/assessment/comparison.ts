import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";

/**
 * Pure, client-safe shaping for the self-vs-others comparison report (issue #9).
 * It takes two already-computed normalized profiles — the Subject's own `score`
 * of their words, and the equal-weight `aggregateObservers` "others" profile —
 * and produces the per-tribe rows and the alignment/divergence highlights the
 * report renders. It imports no scoring core and no `server-only` module (only
 * the tribe metadata and a type), so the comparison view can compute display
 * data without pulling the word→tribe mapping toward the client.
 */

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /** `others - self`: positive where others read the tribe higher than you do. */
  gap: number;
  /** Self bar-fill fraction against the shared max of both reads (0–1). */
  selfRelative: number;
  /** Others bar-fill fraction against the shared max of both reads (0–1). */
  othersRelative: number;
}

export interface ComparisonHighlights {
  /**
   * The tribe others rate most above your own read — where the 360 surfaces a
   * strength you underplay ("the gap is where growth lives"). Null when others
   * never read any tribe higher than you.
   */
  biggestBlindSpot: ComparisonRow | null;
  /**
   * The tribe you rate most above others — where your self-read runs ahead of
   * how you come across. Null when you never read any tribe higher than others.
   */
  biggestOverestimate: ComparisonRow | null;
  /**
   * The tribe both reads rate highest in common — the strongest shared signal.
   * Null when there is no signal at all.
   */
  strongestAgreement: ComparisonRow | null;
}

/**
 * Pair the Subject's profile with the aggregated "others" profile into one row
 * per tribe, ordered by the stronger of the two reads (canonical tie-break) so
 * the most salient tribes lead. Both bars are scaled against a single shared
 * maximum, so a self bar and an others bar of the same length mean the same
 * score and the two columns are directly comparable.
 */
export function buildComparison(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const selfBySlug = new Map(self.map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const max = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  const rows: ComparisonRow[] = tribes.map((tribe) => {
    const selfScore = selfBySlug.get(tribe.slug) ?? 0;
    const othersScore = othersBySlug.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      self: selfScore,
      others: othersScore,
      gap: othersScore - selfScore,
      selfRelative: max > 0 ? selfScore / max : 0,
      othersRelative: max > 0 ? othersScore / max : 0,
    };
  });

  // Stable sort by the stronger read, so ties fall back to canonical order.
  return rows.sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );
}

/**
 * Pull the headline alignment and divergence from the comparison rows: where
 * others see more than you (blind spot), where you see more than others
 * (overestimate), and where both agree most strongly. Each is null when that
 * signal is absent, so the report can omit an empty highlight cleanly.
 */
export function comparisonHighlights(
  rows: readonly ComparisonRow[],
): ComparisonHighlights {
  let biggestBlindSpot: ComparisonRow | null = null;
  let biggestOverestimate: ComparisonRow | null = null;
  let strongestAgreement: ComparisonRow | null = null;

  for (const row of rows) {
    if (row.gap > 0 && (!biggestBlindSpot || row.gap > biggestBlindSpot.gap)) {
      biggestBlindSpot = row;
    }
    if (
      row.gap < 0 &&
      (!biggestOverestimate || row.gap < biggestOverestimate.gap)
    ) {
      biggestOverestimate = row;
    }

    // Agreement = how high both reads rate the tribe in common, tie-broken by
    // the smaller divergence.
    const shared = Math.min(row.self, row.others);
    if (shared > 0) {
      const bestShared = strongestAgreement
        ? Math.min(strongestAgreement.self, strongestAgreement.others)
        : 0;
      if (
        !strongestAgreement ||
        shared > bestShared ||
        (shared === bestShared &&
          Math.abs(row.gap) < Math.abs(strongestAgreement.gap))
      ) {
        strongestAgreement = row;
      }
    }
  }

  return { biggestBlindSpot, biggestOverestimate, strongestAgreement };
}
