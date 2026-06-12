import { tribes } from "@/lib/tribes";
import { words, wordWeight } from "./words";

/** A single tribe's standing for a set of selected words. */
export interface TribeScore {
  /** Tribe slug (matches `tribes.ts`). */
  slug: string;
  /** Normalized 0–1 score: points earned / points available for this tribe. */
  score: number;
  /** Raw points earned from the selected words. */
  raw: number;
  /** Total points available for this tribe across the whole word list. */
  available: number;
}

/** The headline outcome: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary must score at least this fraction of the Primary to count as
 * "near" it (≈ within 20%). Tunable (ADR-0001).
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
/**
 * The third tribe must sit at or below this fraction of the Secondary for the
 * Secondary to be "clearly ahead" of it (≈ 20% gap). Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** Total points available for each tribe across the whole word list. */
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

/** Fast lookup from a word to its mapping. */
const wordIndex: Map<string, (typeof words)[number]> = new Map(
  words.map((mapping) => [mapping.word, mapping]),
);

/**
 * Scores a set of selected words, returning a normalized 0–1 `TribeScore` for
 * every tribe, ranked highest first. A shared word contributes 0.5 to each of
 * its tribes; normalization is by each tribe's own available points so tribes
 * with fewer words still compete fairly (ADR-0001). Unknown words are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const raw = new Map<string, number>();
  for (const tribe of tribes) raw.set(tribe.slug, 0);

  for (const word of selectedWords) {
    const mapping = wordIndex.get(word);
    if (!mapping) continue;
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      raw.set(slug, (raw.get(slug) ?? 0) + weight);
    }
  }

  return tribes
    .map((tribe) => {
      const earned = raw.get(tribe.slug) ?? 0;
      const available = availableByTribe.get(tribe.slug) ?? 0;
      return {
        slug: tribe.slug,
        raw: earned,
        available,
        score: available > 0 ? earned / available : 0,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Derives the headline result from ranked tribe scores. The Primary is always
 * the highest score. A Secondary is named only when it scores near the Primary
 * (≥ {@link SECONDARY_NEAR_PRIMARY_RATIO} of it) and is clearly ahead of the
 * third tribe (third ≤ {@link SECONDARY_AHEAD_OF_THIRD_RATIO} of it); otherwise
 * only a Primary is returned, so the result is honest rather than forced.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const primary = ranked[0];
  const candidate = ranked[1];
  const third = ranked[2];

  const nearPrimary =
    primary.score > 0 &&
    candidate !== undefined &&
    candidate.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO;

  const aheadOfThird =
    candidate !== undefined &&
    candidate.score > 0 &&
    (third === undefined ||
      third.score <= candidate.score * SECONDARY_AHEAD_OF_THIRD_RATIO);

  return nearPrimary && aheadOfThird
    ? { primary, secondary: candidate }
    : { primary };
}
