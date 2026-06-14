import { tribes } from "../tribes";
import { assessmentWords, type AssessmentWord } from "./words";

/** A single tribe's normalized score for a set of selected words. */
export interface TribeScore {
  /** The tribe slug. */
  slug: string;
  /** Normalized 0–1 score: points earned ÷ points available for this tribe. */
  score: number;
}

/** The outcome of an assessment: always a Primary, sometimes a Secondary. */
export interface DerivedResult {
  /** Slug of the highest-scoring tribe. */
  primary: string;
  /** Slug of the runner-up, present only when it genuinely qualifies. */
  secondary?: string;
}

/**
 * How close the Secondary must be to the Primary to be shown, and how clearly
 * ahead of the third tribe it must be. Tunable (ADR-0001): a Secondary is named
 * only when it scores within {@link SECONDARY_MARGIN} of the Primary AND the
 * third tribe is at least that far behind the Secondary.
 */
export const SECONDARY_MARGIN = 0.2;

/** A word's weight toward each tribe it maps to: split evenly across its tribes. */
function wordWeight(word: AssessmentWord): number {
  return 1 / word.tribes.length;
}

/**
 * Total points available for each tribe across the whole word list — the
 * normalization denominator. Computed once from the word data so tribes with
 * more words don't gain an unfair advantage (a 6-word tribe and a 10-word tribe
 * each top out at 1.0 when all their words are picked).
 */
const availablePoints: Record<string, number> = (() => {
  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const word of assessmentWords) {
    const weight = wordWeight(word);
    for (const slug of word.tribes) totals[slug] += weight;
  }
  return totals;
})();

/** Case-insensitive lookup from word text to its mapping. */
const wordIndex: Map<string, AssessmentWord> = new Map(
  assessmentWords.map((w) => [w.word.toLowerCase(), w]),
);

/**
 * Score a set of selected words into a normalized 0–1 value for every tribe.
 *
 * Each word contributes its weight to each mapped tribe; a shared (two-tribe)
 * word contributes 0.5 to each. A tribe's score is its earned points divided by
 * the points available for it across the whole list. Unknown or duplicate words
 * are ignored. Returns one entry per tribe, in canonical tribe order.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned: Record<string, number> = {};
  for (const tribe of tribes) earned[tribe.slug] = 0;

  const counted = new Set<string>();
  for (const selection of selectedWords) {
    const key = selection.toLowerCase();
    if (counted.has(key)) continue;
    const word = wordIndex.get(key);
    if (!word) continue;
    counted.add(key);
    const weight = wordWeight(word);
    for (const slug of word.tribes) earned[slug] += weight;
  }

  return tribes.map((tribe) => ({
    slug: tribe.slug,
    score:
      availablePoints[tribe.slug] > 0
        ? earned[tribe.slug] / availablePoints[tribe.slug]
        : 0,
  }));
}

/**
 * Derive the headline result from per-tribe scores. The Primary is always the
 * highest-scoring tribe. A Secondary is named only when it is near the Primary
 * (within {@link SECONDARY_MARGIN}) AND clearly ahead of the third tribe — so a
 * runner-up that is far behind the Primary, or effectively tied with the third,
 * is honestly left out rather than forced.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  const result: DerivedResult = { primary: primary.slug };

  const nearPrimary =
    secondary !== undefined &&
    secondary.score > 0 &&
    secondary.score >= primary.score * (1 - SECONDARY_MARGIN);
  const clearOfThird =
    third === undefined || third.score <= secondary!.score * (1 - SECONDARY_MARGIN);

  if (nearPrimary && clearOfThird) {
    result.secondary = secondary!.slug;
  }

  return result;
}
