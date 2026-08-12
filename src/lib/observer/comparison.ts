import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure, client-safe comparison of a Subject's own profile against the
 * aggregated "others" profile (issue #9). It only reshapes two `TribeScore[]`
 * arrays into per-tribe pairs with a signed gap — no scoring, no server-only
 * import — so the comparison report can compute alignment/divergence on the
 * client if it wants, and the math stays unit-testable without the DB or LLM.
 */
export interface TribeComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /**
   * `self − others`: positive means the Subject rates this tribe higher than
   * others do (a blind spot others don't see); negative means others see it
   * more strongly than the Subject does. Near zero is alignment.
   */
  gap: number;
}

/**
 * Pair the Subject's profile with the "others" profile tribe-by-tribe, in the
 * Subject profile's (canonical) order. Others are matched by slug, so the two
 * arrays need not share an order, and a tribe absent from `others` is treated
 * as scoring zero.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): TribeComparison[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));
  return self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersScore,
      gap: s.score - othersScore,
    };
  });
}
