import { tribes } from "@/lib/tribes";
import { words, weightPerTribe, type WordMapping } from "./words";

/** A single tribe's normalized score for a set of selected words. */
export interface TribeScore {
  /** Tribe slug. */
  slug: string;
  /** Normalized 0–1 score: points earned for this tribe / points available. */
  score: number;
}

/** The headline outcome derived from a full set of tribe scores. */
export interface AssessmentResult {
  /** The highest-scoring tribe's slug. Always present. */
  primary: string;
  /** A close runner-up, only when it genuinely qualifies (see deriveResult). */
  secondary?: string;
}

/**
 * Tunable thresholds for whether a Secondary tribe is named.
 *
 * A Secondary is shown only when it scores *near* the Primary AND is *clearly
 * ahead* of the third tribe — otherwise the result honestly names a Primary
 * alone (ADR-0001 / PRD result derivation).
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8; // secondary ≥ 80% of primary (within ~20%)
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8; // third ≤ 80% of secondary (clearly behind)

/**
 * Total points available for each tribe across the whole word list — the
 * normalization denominator. Computed once from the word data.
 */
function availablePoints(list: WordMapping[] = words): Map<string, number> {
  const available = new Map<string, number>(tribes.map((t) => [t.slug, 0]));
  for (const mapping of list) {
    const weight = weightPerTribe(mapping);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Scores a set of selected words, returning a normalized 0–1 value for every
 * tribe. A word contributes `1 / tribes.length` to each tribe it maps to (0.5
 * each for a two-tribe word); a tribe's score is its earned points divided by
 * the total points available for it across the whole list, so tribes with more
 * or fewer words compete fairly. Unknown or duplicate selections are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const available = availablePoints();
  const earned = new Map<string, number>(tribes.map((t) => [t.slug, 0]));

  const byWord = new Map(words.map((w) => [w.word, w]));
  const counted = new Set<string>();
  for (const selection of selectedWords) {
    const mapping = byWord.get(selection);
    if (!mapping || counted.has(selection)) continue;
    counted.add(selection);
    const weight = weightPerTribe(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((t) => {
    const denom = available.get(t.slug) ?? 0;
    const num = earned.get(t.slug) ?? 0;
    return { slug: t.slug, score: denom === 0 ? 0 : num / denom };
  });
}

/**
 * Derives the headline result from a full set of tribe scores. Primary is
 * always the highest score. Secondary is named only when it scores near the
 * Primary and is clearly ahead of the third tribe; otherwise only a Primary is
 * returned.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  const result: AssessmentResult = { primary: primary.slug };

  if (!secondary || secondary.score <= 0) {
    return result;
  }

  const nearPrimary = secondary.score >= SECONDARY_NEAR_PRIMARY_RATIO * primary.score;
  const aheadOfThird = !third || third.score <= SECONDARY_AHEAD_OF_THIRD_RATIO * secondary.score;

  if (nearPrimary && aheadOfThird) {
    result.secondary = secondary.slug;
  }

  return result;
}
