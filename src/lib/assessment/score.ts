import { tribes } from "../tribes";
import { words, wordWeight } from "./words";

/**
 * Pure scoring core for the Tribe Index assessment.
 *
 * Scoring is *normalized* (ADR-0001): a tribe's score is the points it earned
 * from the selected words divided by the total points available for it across
 * the whole word list. Because the word list maps unevenly to tribes (some
 * have 6 words, some 10+), a raw sum would structurally favor high-coverage
 * tribes; normalizing makes every tribe a 0–1 fraction of *its own* ceiling,
 * so they compete fairly regardless of coverage.
 */

export interface TribeScore {
  /** Tribe slug. */
  slug: string;
  /** Tribe display name. */
  name: string;
  /** Normalized score in the range [0, 1]. */
  score: number;
}

export interface AssessmentResult {
  /** The highest-scoring tribe. Always present. */
  primary: TribeScore;
  /** A close runner-up, present only when it genuinely qualifies. */
  secondary?: TribeScore;
}

/**
 * How close the secondary must be to the primary to be shown: it must score
 * within this fraction of the primary (≈ within 20%).
 */
export const SECONDARY_PRIMARY_PROXIMITY = 0.2;
/**
 * How clearly the secondary must lead the third tribe to be shown: the third
 * must trail the secondary by at least this fraction, otherwise the runner-up
 * is treated as part of a cluster rather than a distinct secondary.
 */
export const SECONDARY_THIRD_SEPARATION = 0.2;

/**
 * Scores the selected words, returning a normalized [0, 1] score for every
 * tribe, in canonical tribe order. Words not present in the list are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords);
  const earned: Record<string, number> = {};
  const available: Record<string, number> = {};
  for (const t of tribes) {
    earned[t.slug] = 0;
    available[t.slug] = 0;
  }

  for (const mapping of words) {
    const weight = wordWeight(mapping);
    const isSelected = selected.has(mapping.word);
    for (const slug of mapping.tribes) {
      available[slug] += weight;
      if (isSelected) earned[slug] += weight;
    }
  }

  return tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: available[t.slug] === 0 ? 0 : earned[t.slug] / available[t.slug],
  }));
}

/**
 * Derives the headline result from a set of tribe scores. Always names a
 * Primary (the highest score). Names a Secondary only when the runner-up scores
 * near the Primary *and* is clearly ahead of the third tribe — otherwise the
 * result is honestly Primary-only.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  const secondaryQualifies =
    secondary !== undefined &&
    secondary.score > 0 &&
    secondary.score >= primary.score * (1 - SECONDARY_PRIMARY_PROXIMITY) &&
    (third === undefined ||
      third.score <= secondary.score * (1 - SECONDARY_THIRD_SEPARATION));

  return secondaryQualifies ? { primary, secondary } : { primary };
}
