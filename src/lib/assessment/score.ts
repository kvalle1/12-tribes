import { tribes } from "../tribes";
import { words, wordWeight, type AssessmentWord } from "./words";

/** A single tribe's normalized assessment score (0–1). */
export interface TribeScore {
  slug: string;
  score: number;
}

/** The derived headline result: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * Tunable thresholds for deriving a Secondary tribe (ADR-0001). A Secondary is
 * shown only when it scores *near* the Primary and is *clearly ahead* of the
 * third tribe — otherwise the result names a Primary alone, keeping it honest.
 */
export const SECONDARY_NEAR_PRIMARY = 0.8; // ≥ 80% of Primary (within ~20%)
export const SECONDARY_AHEAD_OF_THIRD = 0.8; // third must be ≤ 80% of Secondary

/**
 * The total points available to each tribe across the *whole* word list — the
 * normalization denominator. A solo word contributes 1.0; a shared word 0.5.
 * Computed once from the word data so it can never drift from the mapping.
 */
function availablePoints(list: AssessmentWord[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of tribes) totals.set(t.slug, 0);

  for (const word of list) {
    const weight = wordWeight(word);
    for (const slug of word.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
}

/**
 * Score a set of selected words into a normalized 0–1 value per tribe.
 *
 * A tribe's score is the points earned for it divided by the total points
 * available to it across the whole word list (ADR-0001), so tribes with broad
 * and narrow word coverage compete fairly — every tribe maxes at 1.0. A shared
 * word contributes 0.5 to each of its mapped tribes. Unknown selected words are
 * ignored. All 12 tribes are returned, in canonical tribe order.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const available = availablePoints(words);
  const byWord = new Map(words.map((w) => [w.word, w]));
  const selected = new Set(selectedWords);

  const earned = new Map<string, number>();
  for (const t of tribes) earned.set(t.slug, 0);

  for (const wordName of selected) {
    const word = byWord.get(wordName);
    if (!word) continue; // ignore words not in the list
    const weight = wordWeight(word);
    for (const slug of word.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((t) => {
    const total = available.get(t.slug) ?? 0;
    const points = earned.get(t.slug) ?? 0;
    return { slug: t.slug, score: total > 0 ? points / total : 0 };
  });
}

/**
 * Derive the headline result from per-tribe scores. Always returns a Primary
 * (the highest score). Returns a Secondary only when it scores near the Primary
 * (≥ SECONDARY_NEAR_PRIMARY of it) *and* is clearly ahead of the third tribe
 * (third ≤ SECONDARY_AHEAD_OF_THIRD of the Secondary); otherwise the result is
 * a Primary alone.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, second, third] = ranked;

  const result: AssessmentResult = { primary };

  if (
    second &&
    second.score > 0 &&
    second.score >= primary.score * SECONDARY_NEAR_PRIMARY &&
    (!third || third.score <= second.score * SECONDARY_AHEAD_OF_THIRD)
  ) {
    result.secondary = second;
  }

  return result;
}
