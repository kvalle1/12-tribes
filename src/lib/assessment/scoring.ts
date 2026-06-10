import { tribes } from "../tribes";
import { words, type AssessmentWord } from "./words";

/** A normalized 0–1 score per tribe, keyed by tribe slug. */
export type TribeScores = Record<string, number>;

export interface AssessmentResult {
  /** The top-scoring tribe's slug. Always present. */
  primary: string;
  /** The second tribe's slug, only when it qualifies (see deriveResult). */
  secondary?: string;
}

/** Points a solo word gives its tribe. */
const SOLO_WEIGHT = 1;
/** Points a shared word gives to *each* of its tribes. */
const SHARED_WEIGHT = 0.5;

/**
 * Secondary qualifies only when it is *near* the Primary — within this
 * fraction below it — and *clearly ahead* of the third tribe by at least this
 * fraction above it (ADR-0001 / ASSESSMENT_DESIGN.md).
 */
export const SECONDARY_NEAR_PRIMARY = 0.2;
export const SECONDARY_AHEAD_OF_THIRD = 0.2;

function weightFor(word: AssessmentWord): number {
  return word.tribes.length === 1 ? SOLO_WEIGHT : SHARED_WEIGHT;
}

/**
 * Total points available to each tribe across the *whole* word list — the
 * denominator that makes a 6-word tribe and a 10-word tribe compete fairly.
 */
function availablePointsByTribe(): TribeScores {
  const available: TribeScores = {};
  for (const tribe of tribes) available[tribe.slug] = 0;
  for (const word of words) {
    const weight = weightFor(word);
    for (const slug of word.tribes) {
      available[slug] = (available[slug] ?? 0) + weight;
    }
  }
  return available;
}

/**
 * Score a set of selected words. Returns a normalized 0–1 value for every
 * tribe: the points the selection earned for that tribe divided by the total
 * points available to it across the whole list. A shared word contributes 0.5
 * to each of its tribes; a solo word contributes 1.
 *
 * Unknown or duplicate selections are ignored; the input order is irrelevant.
 */
export function score(selectedWords: string[]): TribeScores {
  const available = availablePointsByTribe();
  const earned: TribeScores = {};
  for (const tribe of tribes) earned[tribe.slug] = 0;

  const selected = new Set(selectedWords);
  for (const word of words) {
    if (!selected.has(word.word)) continue;
    const weight = weightFor(word);
    for (const slug of word.tribes) {
      earned[slug] += weight;
    }
  }

  const scores: TribeScores = {};
  for (const tribe of tribes) {
    const avail = available[tribe.slug];
    scores[tribe.slug] = avail > 0 ? earned[tribe.slug] / avail : 0;
  }
  return scores;
}

/**
 * Derive the Primary (and optional Secondary) tribe from a score map.
 *
 * Primary is always the highest-scoring tribe. Ties break deterministically by
 * tribe number (the canonical order in `tribes`). Secondary is returned only
 * when it is near the Primary (within SECONDARY_NEAR_PRIMARY below it) and
 * clearly ahead of the third tribe (at least SECONDARY_AHEAD_OF_THIRD above it).
 */
export function deriveResult(scores: TribeScores): AssessmentResult {
  const ranked = tribes
    .map((tribe) => ({
      slug: tribe.slug,
      number: tribe.number,
      value: scores[tribe.slug] ?? 0,
    }))
    .sort((a, b) => b.value - a.value || a.number - b.number);

  const [first, second, third] = ranked;
  const result: AssessmentResult = { primary: first.slug };

  const secondValue = second?.value ?? 0;
  const thirdValue = third?.value ?? 0;
  const nearPrimary = secondValue >= first.value * (1 - SECONDARY_NEAR_PRIMARY);
  const aheadOfThird = secondValue >= thirdValue * (1 + SECONDARY_AHEAD_OF_THIRD);

  if (second && secondValue > 0 && nearPrimary && aheadOfThird) {
    result.secondary = second.slug;
  }

  return result;
}
