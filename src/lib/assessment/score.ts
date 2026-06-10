import { tribes } from "@/lib/tribes";
import { mappingWeight, wordMappings, type WordMapping } from "./words";

/**
 * Pure scoring core for the Tribe Index assessment.
 *
 * `score()` turns a set of selected words into a normalized 0–1 score for every
 * tribe; `deriveResult()` turns those scores into a Primary tribe and an
 * optional Secondary. Both are pure and side-effect free so they can be reused
 * unchanged across the self assessment, the 360 observer aggregation, and tests.
 */

/** A normalized score for a single tribe. */
export interface TribeScore {
  /** Tribe slug, matching `tribes.ts`. */
  slug: string;
  /** Points earned for this tribe from the selected words. */
  earned: number;
  /** Total points available for this tribe across the whole word list. */
  available: number;
  /** Normalized score, `earned / available`, in the range 0–1. */
  score: number;
}

/** The outcome of an assessment: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * Result-derivation thresholds (ADR-0001). Tunable; ship with reasonable
 * defaults pending calibration against real data.
 */
export const SECONDARY_THRESHOLDS = {
  /** Secondary must score at least this fraction of Primary (≈ "within 20%"). */
  nearPrimaryRatio: 0.8,
  /**
   * The third tribe must score no more than this fraction of Secondary for the
   * Secondary to count as "clearly ahead of the third".
   */
  aheadOfThirdRatio: 0.8,
} as const;

/**
 * Total points available for each tribe across the whole word list: the sum of
 * the per-mapping weight (1.0 single / 0.5 shared) for every word touching it.
 */
function availablePointsByTribe(
  mappings: readonly WordMapping[],
): Map<string, number> {
  const available = new Map<string, number>();
  for (const mapping of mappings) {
    const weight = mappingWeight(mapping);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Score a set of selected words. Returns one {@link TribeScore} for every tribe
 * in `tribes.ts`, in canonical (number) order.
 *
 * Scoring is normalized (ADR-0001): a tribe's score is the points it earned from
 * the selection divided by the points available to it across the whole list, so
 * a tribe with few words and a tribe with many compete fairly. A shared word
 * contributes 0.5 to each of its tribes. Unknown and duplicate words are
 * ignored (selection is treated as a set).
 */
export function score(
  selectedWords: readonly string[],
  mappings: readonly WordMapping[] = wordMappings,
): TribeScore[] {
  const selected = new Set(selectedWords);
  const available = availablePointsByTribe(mappings);

  const earned = new Map<string, number>();
  for (const mapping of mappings) {
    if (!selected.has(mapping.word)) continue;
    const weight = mappingWeight(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const tribeAvailable = available.get(tribe.slug) ?? 0;
    const tribeEarned = earned.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      earned: tribeEarned,
      available: tribeAvailable,
      score: tribeAvailable > 0 ? tribeEarned / tribeAvailable : 0,
    };
  });
}

/**
 * Derive the Primary (and optional Secondary) tribe from a set of scores.
 *
 * Primary is always the highest-scoring tribe. A Secondary is named only when it
 * scores near the Primary (≥ {@link SECONDARY_THRESHOLDS.nearPrimaryRatio} of
 * it) *and* is clearly ahead of the third tribe (third ≤
 * {@link SECONDARY_THRESHOLDS.aheadOfThirdRatio} of the Secondary). A Secondary
 * with a zero score is never named.
 */
export function deriveResult(scores: readonly TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  if (!secondary || secondary.score <= 0) {
    return { primary };
  }

  const nearPrimary =
    secondary.score >= primary.score * SECONDARY_THRESHOLDS.nearPrimaryRatio;
  const aheadOfThird =
    !third ||
    third.score <= secondary.score * SECONDARY_THRESHOLDS.aheadOfThirdRatio;

  return nearPrimary && aheadOfThird ? { primary, secondary } : { primary };
}
