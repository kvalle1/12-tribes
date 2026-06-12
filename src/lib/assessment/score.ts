import { tribes } from "../tribes";
import { words, weightFor } from "./words";

/**
 * A single tribe's normalized score for a set of selected words.
 *
 * `score` is `earned / available` — a 0–1 value comparable across tribes
 * regardless of how many words map to each (ADR-0001 normalized scoring).
 */
export interface TribeScore {
  slug: string;
  /** 1-based tribe number (matches `tribes.ts`). */
  number: number;
  /** Points earned for this tribe from the selected words. */
  earned: number;
  /** Total points available for this tribe across the whole word list. */
  available: number;
  /** Normalized score, `earned / available`, in [0, 1]. */
  score: number;
}

export interface DerivedResult {
  primary: TribeScore;
  /** Present only when a Secondary genuinely qualifies (see thresholds below). */
  secondary?: TribeScore;
}

/**
 * A Secondary must score within this fraction of the Primary to count as
 * "near" it (≈ within 20%).
 */
export const SECONDARY_MAX_GAP_FROM_PRIMARY = 0.2;

/**
 * A Secondary must lead the third-ranked tribe by at least this fraction to be
 * "clearly ahead" of it — otherwise the second/third pair is too close to call
 * and only a Primary is named.
 */
export const SECONDARY_MIN_LEAD_OVER_THIRD = 0.2;

/** Total points available for each tribe across the entire word list. */
const availableByTribe: Record<string, number> = (() => {
  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const entry of words) {
    const weight = weightFor(entry);
    for (const slug of entry.tribes) totals[slug] += weight;
  }
  return totals;
})();

/**
 * Scores a set of selected words, returning a normalized score for every tribe
 * (in `tribes.ts` order). Unrecognized words are ignored. Matching is
 * case-insensitive so callers needn't worry about display casing.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords.map((w) => w.toLowerCase()));

  const earnedByTribe: Record<string, number> = {};
  for (const tribe of tribes) earnedByTribe[tribe.slug] = 0;

  for (const entry of words) {
    if (!selected.has(entry.word.toLowerCase())) continue;
    const weight = weightFor(entry);
    for (const slug of entry.tribes) earnedByTribe[slug] += weight;
  }

  return tribes.map((tribe) => {
    const earned = earnedByTribe[tribe.slug];
    const available = availableByTribe[tribe.slug];
    return {
      slug: tribe.slug,
      number: tribe.number,
      earned,
      available,
      score: available === 0 ? 0 : earned / available,
    };
  });
}

/**
 * Derives the result from a set of tribe scores: always a Primary (the highest
 * score, ties broken by tribe number for determinism), plus a Secondary only
 * when it scores near the Primary *and* clearly ahead of the third tribe.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  const ranked = [...scores].sort(
    (a, b) => b.score - a.score || a.number - b.number,
  );

  const primary = ranked[0];
  const second = ranked[1];
  const third = ranked[2];

  // No signal at all (e.g. nothing selected) → just a Primary.
  if (!primary || primary.score <= 0 || !second || second.score <= 0) {
    return { primary };
  }

  const nearPrimary =
    second.score >= primary.score * (1 - SECONDARY_MAX_GAP_FROM_PRIMARY);
  const aheadOfThird =
    !third || second.score >= third.score * (1 + SECONDARY_MIN_LEAD_OVER_THIRD);

  if (nearPrimary && aheadOfThird) {
    return { primary, secondary: second };
  }
  return { primary };
}
