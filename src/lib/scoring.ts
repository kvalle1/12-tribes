import { tribes } from "./tribes";
import { words, type WordEntry } from "./words";

/**
 * Pure scoring core for the Tribe Index assessment.
 *
 * Scoring is **normalized** per ADR-0001: a tribe's score is the points it earned
 * from the selected words divided by the total points available to that tribe
 * across the whole word list. This lets a 6-word tribe and a 10-word tribe compete
 * fairly. A shared word (mapped to more than one tribe) contributes a fractional
 * weight to each of its tribes.
 */

/** A normalized score (0–1) per tribe, keyed by tribe slug. */
export type Scores = Record<string, number>;

export interface RankedScore {
  slug: string;
  score: number;
}

export interface AssessmentResult {
  /** Highest-scoring tribe. Always present. */
  primary: RankedScore;
  /** Runner-up, only when it is near the Primary and clearly ahead of the third. */
  secondary: RankedScore | null;
  /** All tribes sorted by score descending (ties broken by tribe number). */
  ranked: RankedScore[];
}

/**
 * Per-(word→tribe) weight. A word mapped to a single tribe contributes 1 point to
 * it; a shared word contributes 0.5 to each of its tribes (ASSESSMENT_DESIGN.md).
 */
function weightOf(entry: WordEntry): number {
  return entry.tribes.length === 1 ? 1 : 0.5;
}

/** Order in which tribes appear in results; used as the deterministic tie-breaker. */
const TRIBE_ORDER = new Map(tribes.map((t) => [t.slug, t.number]));

/** Total points available to each tribe across the entire word list. */
const availablePoints: Scores = (() => {
  const totals: Scores = {};
  for (const t of tribes) totals[t.slug] = 0;
  for (const entry of words) {
    const w = weightOf(entry);
    for (const slug of entry.tribes) {
      totals[slug] = (totals[slug] ?? 0) + w;
    }
  }
  return totals;
})();

/** Fast lookup from word text to its entry. */
const wordIndex = new Map(words.map((entry) => [entry.word, entry]));

/**
 * Scores a set of selected words, returning a normalized 0–1 value for every tribe.
 *
 * Unknown words (not in the list) are ignored. Duplicate selections are counted
 * once. The result always contains an entry for all 12 tribes.
 */
export function score(selectedWords: string[]): Scores {
  const earned: Scores = {};
  for (const t of tribes) earned[t.slug] = 0;

  for (const word of new Set(selectedWords)) {
    const entry = wordIndex.get(word);
    if (!entry) continue;
    const w = weightOf(entry);
    for (const slug of entry.tribes) {
      earned[slug] += w;
    }
  }

  const scores: Scores = {};
  for (const t of tribes) {
    const available = availablePoints[t.slug];
    scores[t.slug] = available > 0 ? earned[t.slug] / available : 0;
  }
  return scores;
}

/**
 * A Secondary tribe is shown only when it scores near the Primary (within 20%) and
 * is clearly ahead of the third tribe (the third trails the Secondary by ≥ 20%).
 */
const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/**
 * Derives the Primary tribe and an optional Secondary from a set of scores.
 *
 * Always returns a Primary (the highest score). Returns a Secondary only when the
 * runner-up is near the Primary and clearly separated from the third tribe.
 */
export function deriveResult(scores: Scores): AssessmentResult {
  const ranked: RankedScore[] = Object.entries(scores)
    .map(([slug, value]) => ({ slug, score: value }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (TRIBE_ORDER.get(a.slug) ?? 0) - (TRIBE_ORDER.get(b.slug) ?? 0);
    });

  const primary = ranked[0];
  const runnerUp = ranked[1];
  const third = ranked[2];

  let secondary: RankedScore | null = null;
  if (primary && runnerUp && primary.score > 0) {
    const nearPrimary =
      runnerUp.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO;
    const aheadOfThird =
      !third || third.score <= runnerUp.score * SECONDARY_AHEAD_OF_THIRD_RATIO;
    if (nearPrimary && aheadOfThird) {
      secondary = runnerUp;
    }
  }

  return { primary, secondary, ranked };
}
