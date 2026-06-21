import { tribes } from "./tribes";
import { words, type WordMapping } from "./words";

/**
 * The pure scoring core for the Tribe Index assessment.
 *
 * Scoring is **normalized** (ADR 0001): a tribe's score is the points it earned
 * from the selected words divided by the total points available to it across the
 * whole word list, so a 6-word tribe and a 10-word tribe compete fairly. A word
 * mapped to a single tribe is worth a full point; a "shared" word (mapped to two
 * or more tribes) is worth half a point to each tribe it maps to.
 */

/** A normalized score (0–1) per tribe, keyed by tribe slug. */
export type ScoreMap = Record<string, number>;

export interface AssessmentResult {
  /** Slug of the highest-scoring tribe. Always present. */
  primary: string;
  /** Slug of a qualifying Secondary tribe, or null when none qualifies. */
  secondary: string | null;
}

/** A Secondary must score at least this fraction of the Primary to qualify. */
const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
/** The third tribe must fall at or below this fraction of the Secondary. */
const THIRD_BEHIND_SECONDARY_RATIO = 0.8;

/** Points a word contributes to each tribe it maps to: 1 if sole, 0.5 if shared. */
function weightOf(mapping: WordMapping): number {
  return mapping.tribes.length === 1 ? 1 : 0.5;
}

/** Total points available to each tribe across the entire word list. */
function availablePoints(): ScoreMap {
  const totals: ScoreMap = {};
  for (const t of tribes) totals[t.slug] = 0;
  for (const mapping of words) {
    const weight = weightOf(mapping);
    for (const slug of mapping.tribes) {
      totals[slug] += weight;
    }
  }
  return totals;
}

const WORD_BY_NAME = new Map(words.map((w) => [w.word, w]));
const AVAILABLE = availablePoints();
/** Stable, deterministic ordering tie-break: lower tribe number wins. */
const TRIBE_ORDER = new Map(tribes.map((t) => [t.slug, t.number]));

/**
 * Score a set of selected words into a normalized 0–1 value per tribe.
 * Unknown words are ignored; selecting the same word twice counts once.
 */
export function score(selectedWords: string[]): ScoreMap {
  const earned: ScoreMap = {};
  for (const t of tribes) earned[t.slug] = 0;

  for (const word of new Set(selectedWords)) {
    const mapping = WORD_BY_NAME.get(word);
    if (!mapping) continue;
    const weight = weightOf(mapping);
    for (const slug of mapping.tribes) {
      earned[slug] += weight;
    }
  }

  const scores: ScoreMap = {};
  for (const t of tribes) {
    const total = AVAILABLE[t.slug];
    scores[t.slug] = total === 0 ? 0 : earned[t.slug] / total;
  }
  return scores;
}

/**
 * Derive the Primary tribe and an optional Secondary from a score map.
 *
 * A Primary is always returned (the highest score, ties broken by tribe number).
 * A Secondary is returned only when it scores near the Primary (within 20%) and
 * is clearly ahead of the third tribe (the third sits at least 20% below it).
 */
export function deriveResult(scores: ScoreMap): AssessmentResult {
  const ranked = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (TRIBE_ORDER.get(a[0]) ?? 0) - (TRIBE_ORDER.get(b[0]) ?? 0);
  });

  const [primary, primaryScore] = ranked[0];
  const second = ranked[1];
  const third = ranked[2];

  let secondary: string | null = null;
  if (second && primaryScore > 0) {
    const nearPrimary = second[1] >= primaryScore * SECONDARY_NEAR_PRIMARY_RATIO;
    const aheadOfThird = !third || third[1] <= second[1] * THIRD_BEHIND_SECONDARY_RATIO;
    if (nearPrimary && aheadOfThird) {
      secondary = second[0];
    }
  }

  return { primary, secondary };
}
