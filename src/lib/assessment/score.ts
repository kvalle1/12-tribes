import { tribes } from "../tribes";
import { words, wordWeight, type WordMapping } from "./words";

/**
 * Pure scoring core for the Tribe Index assessment (ADR-0001, normalized
 * scoring). Given the words a person selected, produce a comparable 0–1 score
 * for every tribe, then derive a Primary (and sometimes a Secondary) tribe.
 *
 * Scoring is **normalized**: a tribe's score is the points it earned from the
 * selection divided by the total points available for it across the whole word
 * list. This removes the coverage bias of the uneven word list, so a 6-word
 * tribe and a 10-word tribe compete fairly.
 */

/** A single tribe's normalized score plus the raw numbers behind it. */
export interface TribeScore {
  slug: string;
  /** Normalized 0–1 value: `earned / available` (0 when the tribe has no words). */
  score: number;
  /** Raw weighted points earned from the selection. */
  earned: number;
  /** Total weighted points available for this tribe across the whole word list. */
  available: number;
}

export interface DerivedResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary must score at least this fraction of the Primary (i.e. be within
 * ~20% of it) to be shown. Tunable.
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;

/**
 * A Secondary must score at least this multiple of the third-place tribe to be
 * "clearly ahead" of it (≈20% margin). Without this gap a Secondary is withheld
 * because the result is really a three-way (or wider) tie. Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 1.2;

/** Total points available per tribe, precomputed once from the word list. */
const availableByTribe: Map<string, number> = (() => {
  const map = new Map<string, number>();
  for (const tribe of tribes) map.set(tribe.slug, 0);
  for (const mapping of words) {
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      map.set(slug, (map.get(slug) ?? 0) + weight);
    }
  }
  return map;
})();

/** Case-insensitive lookup from word text to its mapping. */
const mappingByWord: Map<string, WordMapping> = new Map(
  words.map((mapping) => [mapping.word.trim().toLowerCase(), mapping]),
);

const tribeNumberBySlug: Map<string, number> = new Map(
  tribes.map((tribe) => [tribe.slug, tribe.number]),
);

/**
 * Score a selection of words, returning a normalized {@link TribeScore} for
 * **every** tribe, sorted by score descending (ties broken by tribe number for
 * stable output). Unknown words are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  for (const raw of selectedWords) {
    const mapping = mappingByWord.get(raw.trim().toLowerCase());
    if (!mapping) continue;
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const scores: TribeScore[] = tribes.map((tribe) => {
    const available = availableByTribe.get(tribe.slug) ?? 0;
    const earnedPoints = earned.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      earned: earnedPoints,
      available,
      score: available > 0 ? earnedPoints / available : 0,
    };
  });

  return scores.sort(byScoreThenNumber);
}

/**
 * Derive the result from a set of tribe scores. Always returns a Primary (the
 * highest score). Returns a Secondary only when it is near the Primary (within
 * {@link SECONDARY_NEAR_PRIMARY_RATIO}) **and** clearly ahead of the third tribe
 * (by {@link SECONDARY_AHEAD_OF_THIRD_RATIO}); otherwise only a Primary is named.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort(byScoreThenNumber);
  const primary = ranked[0];
  const candidate = ranked[1];
  const third = ranked[2];

  if (!candidate || candidate.score <= 0) {
    return { primary };
  }

  const nearPrimary =
    candidate.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO;
  const aheadOfThird =
    !third || candidate.score >= third.score * SECONDARY_AHEAD_OF_THIRD_RATIO;

  return nearPrimary && aheadOfThird
    ? { primary, secondary: candidate }
    : { primary };
}

function byScoreThenNumber(a: TribeScore, b: TribeScore): number {
  if (b.score !== a.score) return b.score - a.score;
  return (tribeNumberBySlug.get(a.slug) ?? 0) - (tribeNumberBySlug.get(b.slug) ?? 0);
}
