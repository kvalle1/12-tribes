import { tribes } from "@/lib/tribes";
import { words, type AssessmentWord } from "./words";

/**
 * Pure scoring core for the assessment (ADR-0001, normalized scoring).
 *
 * A tribe's score is the points earned for that tribe divided by the total
 * points available for it across the whole word list — a 0–1 value that is
 * comparable across tribes regardless of how many words map to each. This
 * deliberately avoids structurally favoring high-coverage tribes (Dan,
 * Issachar) over low-coverage ones (Levi, Zebulun, Simeon).
 *
 * Per-word weight feeding the numerator: a word mapped to a single tribe
 * contributes 1.0; a shared word (mapped to two or more tribes) contributes
 * 0.5 to each mapped tribe.
 */

export interface TribeScore {
  /** Tribe slug. */
  slug: string;
  /** Normalized score in [0, 1]. */
  score: number;
}

export interface AssessmentResult {
  /** Always present — the highest-scoring tribe. */
  primary: TribeScore;
  /** Present only when a tribe genuinely qualifies as Secondary. */
  secondary?: TribeScore;
}

/**
 * Secondary is shown only when it scores *near* the Primary AND is *clearly
 * ahead* of the third tribe. Both thresholds are tunable.
 *
 * - near: Secondary must be at least this fraction of the Primary's score
 *   (i.e. within 20% below Primary).
 * - ahead: the third tribe must be at or below this fraction of the
 *   Secondary's score (i.e. Secondary is more than 20% ahead of third).
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** Weight a single word contributes to each of its mapped tribes. */
export function wordWeight(word: AssessmentWord): number {
  return word.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Total points available for each tribe across the entire word list — the
 * denominator in the normalized score. Computed once from the word data.
 */
const availablePoints: Map<string, number> = (() => {
  const totals = new Map<string, number>();
  for (const tribe of tribes) {
    totals.set(tribe.slug, 0);
  }
  for (const word of words) {
    const weight = wordWeight(word);
    for (const slug of word.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
})();

/** Read-only view of the available points per tribe (exposed for inspection/tests). */
export function getAvailablePoints(): Record<string, number> {
  return Object.fromEntries(availablePoints);
}

const wordByName: Map<string, AssessmentWord> = new Map(
  words.map((w) => [w.word, w]),
);

/**
 * Score a selection of words, returning a normalized score for every tribe,
 * in canonical tribe order (by `number`). Unknown words are ignored. The
 * selection is de-duplicated so a repeated word can't double-count.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned = new Map<string, number>();
  for (const tribe of tribes) {
    earned.set(tribe.slug, 0);
  }

  for (const name of new Set(selectedWords)) {
    const word = wordByName.get(name);
    if (!word) continue;
    const weight = wordWeight(word);
    for (const slug of word.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const available = availablePoints.get(tribe.slug) ?? 0;
    const points = earned.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      score: available > 0 ? points / available : 0,
    };
  });
}

/**
 * Derive the result from a set of tribe scores. Always returns a Primary (the
 * highest score); returns a Secondary only when it is near the Primary and
 * clearly ahead of the third tribe. Ties break by input order (which is
 * canonical tribe order for the output of `score`).
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, second, third] = ranked;

  const qualifies =
    second !== undefined &&
    second.score > 0 &&
    second.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO &&
    (third === undefined ||
      third.score <= second.score * SECONDARY_AHEAD_OF_THIRD_RATIO);

  return qualifies ? { primary, secondary: second } : { primary };
}
