import { tribes } from "@/lib/tribes";
import { words, type AssessmentWord } from "@/lib/assessment/words";

/**
 * Pure scoring core for the Tribe Index assessment (ADR-0001).
 *
 * Scoring is **normalized**: a tribe's score is the points it earned from the
 * selected words divided by the total points available for it across the whole
 * word list, yielding a 0–1 value that is comparable across tribes regardless
 * of how many words map to each. A shared word (mapped to more than one tribe)
 * contributes 0.5 to each; a word mapped to a single tribe contributes 1.0.
 *
 * This module is the single home for all normalization and threshold logic and
 * is reused unchanged by the 360 observer aggregation.
 */

export interface TribeScore {
  /** Tribe slug (matches `tribes[].slug`). */
  slug: string;
  /** Normalized score in the range 0–1 (earned / available for this tribe). */
  score: number;
}

export interface AssessmentResult {
  /** The highest-scoring tribe. Always present. */
  primary: TribeScore;
  /** The runner-up, present only when it genuinely qualifies (see thresholds). */
  secondary?: TribeScore;
}

/**
 * A Secondary is "near" the Primary only when it scores at least this fraction
 * of the Primary (i.e. within ~20% below it). Tunable.
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;

/**
 * A Secondary is "clearly ahead" of the third tribe only when the third scores
 * no more than this fraction of the Secondary. Keeps a near-tie with the third
 * tribe from being promoted into a Secondary. Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** Points a word contributes to each tribe it maps to: 1.0 if unique, 0.5 if shared. */
function wordWeight(word: AssessmentWord): number {
  return word.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Total points available for each tribe across the entire word list — the
 * denominator for normalization. Computed once from the word data.
 */
const availablePoints: Record<string, number> = (() => {
  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const word of words) {
    const weight = wordWeight(word);
    for (const slug of word.tribes) totals[slug] += weight;
  }
  return totals;
})();

const tribeNumber: Record<string, number> = Object.fromEntries(
  tribes.map((t) => [t.slug, t.number]),
);

/**
 * Scores a set of selected words, returning a normalized 0–1 score for every
 * tribe (one entry per tribe, in `tribes` order). Unknown words are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned: Record<string, number> = {};
  for (const tribe of tribes) earned[tribe.slug] = 0;

  const selected = new Set(selectedWords);
  for (const word of words) {
    if (!selected.has(word.word)) continue;
    const weight = wordWeight(word);
    for (const slug of word.tribes) earned[slug] += weight;
  }

  return tribes.map((tribe) => {
    const available = availablePoints[tribe.slug];
    return {
      slug: tribe.slug,
      score: available > 0 ? earned[tribe.slug] / available : 0,
    };
  });
}

/**
 * Derives the headline result from a set of tribe scores. Always returns a
 * Primary (the highest score). Returns a Secondary only when the runner-up is
 * near the Primary (within {@link SECONDARY_NEAR_PRIMARY_RATIO}) and clearly
 * ahead of the third tribe (third within {@link SECONDARY_AHEAD_OF_THIRD_RATIO}
 * of the runner-up) — otherwise the result is honestly Primary-only.
 *
 * Ties are broken deterministically by tribe number so the result is stable.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : tribeNumber[a.slug] - tribeNumber[b.slug],
  );

  const [primary, runnerUp, third] = ranked;

  const qualifies =
    runnerUp !== undefined &&
    primary.score > 0 &&
    runnerUp.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO &&
    (third === undefined || third.score <= runnerUp.score * SECONDARY_AHEAD_OF_THIRD_RATIO);

  return qualifies ? { primary, secondary: runnerUp } : { primary };
}
