import { tribes } from "../tribes";
import { words, type WordMapping } from "./words";

/**
 * Pure scoring core for the Tribe Index assessment (ADR-0001).
 *
 * Scoring is *normalized*: a tribe's score is the points a respondent earned
 * for that tribe divided by the total points available for it across the whole
 * word list. A shared word (mapped to more than one tribe) contributes 0.5 to
 * each mapped tribe; a sole-mapped word contributes 1.0. Normalizing by each
 * tribe's available points lets a 6-word tribe and a 10-word tribe compete
 * fairly.
 *
 * Both exported functions are pure — no I/O, no shared mutable state.
 */

/** A normalized 0–1 score for every tribe, keyed by tribe slug. */
export type TribeScores = Record<string, number>;

export interface AssessmentResult {
  /** Slug of the highest-scoring tribe. Always present. */
  primary: string;
  /** Slug of the runner-up, only when it qualifies (see `deriveResult`). */
  secondary: string | null;
}

/**
 * A Secondary qualifies only when it is "near" the Primary and "clearly ahead"
 * of the third tribe. Both gaps use the same relative threshold: the runner-up
 * must be within this fraction of the Primary, and the third tribe must be more
 * than this fraction below the runner-up.
 */
const NEAR_THRESHOLD = 0.2;

/** Points a word contributes to each tribe it maps to: 0.5 if shared, else 1. */
function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? 0.5 : 1;
}

/**
 * Total points available for each tribe across the whole word list — the
 * normalization denominator. Computed once from the word data.
 */
const availablePoints: TribeScores = (() => {
  const totals: TribeScores = Object.fromEntries(
    tribes.map((t) => [t.slug, 0]),
  );
  for (const mapping of words) {
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      totals[slug] = (totals[slug] ?? 0) + weight;
    }
  }
  return totals;
})();

const wordsByName: Map<string, WordMapping> = new Map(
  words.map((w) => [w.word, w]),
);

/**
 * Score a set of selected words into a normalized 0–1 value per tribe.
 *
 * Every tribe appears in the result (unselected tribes score 0). Words not in
 * the word list are ignored. Duplicate selections are counted once.
 */
export function score(selectedWords: string[]): TribeScores {
  const earned: TribeScores = Object.fromEntries(
    tribes.map((t) => [t.slug, 0]),
  );

  for (const word of new Set(selectedWords)) {
    const mapping = wordsByName.get(word);
    if (!mapping) continue;
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      earned[slug] += weight;
    }
  }

  const scores: TribeScores = {};
  for (const slug of Object.keys(earned)) {
    const available = availablePoints[slug];
    scores[slug] = available > 0 ? earned[slug] / available : 0;
  }
  return scores;
}

/**
 * Derive the Primary tribe and an optional Secondary from a set of scores.
 *
 * The Primary is always the top scorer. A Secondary is returned only when it
 * scores near the Primary (within `NEAR_THRESHOLD` of it) *and* is clearly
 * ahead of the third tribe (the third is more than `NEAR_THRESHOLD` below it).
 * Ties are broken by tribe number for determinism.
 */
export function deriveResult(scores: TribeScores): AssessmentResult {
  const tribeNumber = new Map(tribes.map((t) => [t.slug, t.number]));
  const ranked = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (tribeNumber.get(a[0]) ?? 0) - (tribeNumber.get(b[0]) ?? 0);
  });

  const [primarySlug, primaryScore] = ranked[0];
  const result: AssessmentResult = { primary: primarySlug, secondary: null };

  const runnerUp = ranked[1];
  if (!runnerUp || primaryScore <= 0) return result;

  const [secondarySlug, secondaryScore] = runnerUp;
  if (secondaryScore <= 0) return result;

  const nearPrimary =
    (primaryScore - secondaryScore) / primaryScore <= NEAR_THRESHOLD;

  const third = ranked[2];
  const thirdScore = third ? third[1] : 0;
  const aheadOfThird =
    (secondaryScore - thirdScore) / secondaryScore > NEAR_THRESHOLD;

  if (nearPrimary && aheadOfThird) {
    result.secondary = secondarySlug;
  }
  return result;
}
