import { tribes } from "../tribes";
import { words, type WordMapping } from "./words";

/**
 * Pure scoring core for the Tribe Index assessment.
 *
 * `score(selectedWords)` turns a set of chosen words into a normalized 0–1
 * score for every one of the 12 tribes. `deriveResult(scores)` reads those
 * scores and names a Primary tribe plus an optional Secondary.
 *
 * Scoring is **normalized** (ADR-0001): a tribe's score is the points earned
 * for it divided by the total points available for it across the whole word
 * list. That makes a 6-word tribe and a 10-word tribe compete fairly — a tribe
 * isn't advantaged just because more words happen to point at it.
 */

/** Weight a word contributes to a tribe it exclusively signals. */
export const EXCLUSIVE_WORD_WEIGHT = 1;
/** Weight a shared word contributes to each tribe it signals. */
export const SHARED_WORD_WEIGHT = 0.5;

/**
 * A Secondary qualifies only when it scores at least this fraction of the
 * Primary (i.e. within 20% of it).
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
/**
 * A Secondary must be clearly ahead of the third tribe: the third tribe may
 * score at most this fraction of the Secondary.
 */
export const SECONDARY_CLEAR_OF_THIRD_RATIO = 0.8;

export interface TribeScore {
  slug: string;
  name: string;
  /** Normalized score in [0, 1]. */
  score: number;
}

export interface AssessmentResult {
  primary: TribeScore;
  /** Present only when a Secondary genuinely qualifies. */
  secondary?: TribeScore;
}

/** The points a single word contributes to each tribe it signals. */
function weightOf(mapping: WordMapping): number {
  return mapping.tribes.length > 1
    ? SHARED_WORD_WEIGHT
    : EXCLUSIVE_WORD_WEIGHT;
}

/**
 * Score a set of selected words, returning a normalized score for every tribe
 * in canonical (tribe `number`) order. Unknown words are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords);

  // Total points available per tribe across the whole list (the denominator),
  // and the points actually earned from the selection (the numerator).
  const available = new Map<string, number>();
  const earned = new Map<string, number>();

  for (const mapping of words) {
    const weight = weightOf(mapping);
    const chosen = selected.has(mapping.word);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
      if (chosen) {
        earned.set(slug, (earned.get(slug) ?? 0) + weight);
      }
    }
  }

  return tribes.map((tribe) => {
    const avail = available.get(tribe.slug) ?? 0;
    const got = earned.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: avail > 0 ? got / avail : 0,
    };
  });
}

/**
 * Derive a Primary (always) and an optional Secondary from a set of tribe
 * scores.
 *
 * Primary is the highest-scoring tribe. A Secondary is named only when it both
 * scores near the Primary (within `SECONDARY_NEAR_PRIMARY_RATIO`) and is
 * clearly ahead of the third tribe (the third scores no more than
 * `SECONDARY_CLEAR_OF_THIRD_RATIO` of it) — otherwise the result is an honest
 * Primary alone.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  const secondaryQualifies =
    secondary !== undefined &&
    secondary.score > 0 &&
    secondary.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO &&
    (third === undefined ||
      third.score <= secondary.score * SECONDARY_CLEAR_OF_THIRD_RATIO);

  return secondaryQualifies ? { primary, secondary } : { primary };
}
