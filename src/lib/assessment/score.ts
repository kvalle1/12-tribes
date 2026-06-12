import { tribes } from "../tribes";
import { words, type WordMapping } from "./words";

/** A single tribe's normalized score (0..1) for a set of selected words. */
export interface TribeScore {
  slug: string;
  score: number;
}

/** The derived headline result: always a Primary, and a Secondary only when it qualifies. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary must score within this fraction of the Primary to be "near" it.
 * 0.20 => Secondary must be at least 80% of the Primary's score.
 */
export const SECONDARY_PRIMARY_MARGIN = 0.2;

/**
 * A Secondary must lead the third-place tribe by at least this (relative) margin
 * to be "clearly ahead". 0.15 => third place must sit at or below 85% of the
 * Secondary's score; otherwise the Secondary is treated as tied with the field
 * and suppressed.
 */
export const SECONDARY_THIRD_MARGIN = 0.15;

/**
 * The points a word contributes per mapped tribe: a single-tribe word is worth
 * 1, a shared word is worth 0.5 to each of its tribes (ADR-0001).
 */
function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Total points available to each tribe across the whole word list — the
 * denominator that normalizes each tribe's score so tribes with more or fewer
 * words still compete fairly.
 */
function availablePointsByTribe(): Map<string, number> {
  const available = new Map<string, number>(tribes.map((t) => [t.slug, 0]));
  for (const mapping of words) {
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Score a set of selected words, returning a normalized 0..1 score for every
 * tribe (in `tribes` order). A tribe's score is the points it earned from the
 * selection divided by the points available to it across the whole list.
 * Unrecognized words are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords);
  const available = availablePointsByTribe();
  const earned = new Map<string, number>(tribes.map((t) => [t.slug, 0]));

  for (const mapping of words) {
    if (!selected.has(mapping.word)) continue;
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((t) => {
    const avail = available.get(t.slug) ?? 0;
    const got = earned.get(t.slug) ?? 0;
    return { slug: t.slug, score: avail === 0 ? 0 : got / avail };
  });
}

/**
 * Derive the headline result from a set of tribe scores. The Primary is always
 * the highest-scoring tribe. A Secondary is returned only when it scores near
 * the Primary (within SECONDARY_PRIMARY_MARGIN) and is clearly ahead of the
 * third tribe (by SECONDARY_THIRD_MARGIN); otherwise only a Primary is named.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  const result: AssessmentResult = { primary };

  const nearPrimary =
    primary.score > 0 &&
    secondary !== undefined &&
    secondary.score > 0 &&
    secondary.score >= primary.score * (1 - SECONDARY_PRIMARY_MARGIN);

  const clearlyAheadOfThird =
    secondary !== undefined &&
    (third === undefined ||
      third.score <= secondary.score * (1 - SECONDARY_THIRD_MARGIN));

  if (nearPrimary && clearlyAheadOfThird) {
    result.secondary = secondary;
  }

  return result;
}
