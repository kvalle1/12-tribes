import { tribes } from "../tribes";
import { words, weightPerTribe, type Word } from "./words";

/**
 * A single tribe's normalized result: the fraction of the points available to
 * that tribe across the whole word list that the respondent's selections earned.
 * Ranges 0–1 and is comparable across tribes regardless of how many words map to
 * each (ADR-0001).
 */
export interface TribeScore {
  slug: string;
  /** Normalized 0–1 score: points earned for this tribe ÷ points available. */
  score: number;
}

/** The derived headline result: always a primary, optionally a secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A secondary is "near" the primary when its score is within this fraction
 * below the primary's (≈ within 20%). Tunable.
 */
export const SECONDARY_NEAR_PRIMARY_MARGIN = 0.2;
/**
 * A secondary is "clearly ahead" of the third tribe when the third's score is
 * at least this fraction below the secondary's (≈ 20%). Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD_MARGIN = 0.2;

/** Normalize a word for lookup so selections match the canonical list loosely. */
function normalize(word: string): string {
  return word.trim().toLowerCase();
}

/** Total points available to each tribe across the entire word list. */
function availablePointsByTribe(list: Word[] = words): Map<string, number> {
  const available = new Map<string, number>();
  for (const entry of list) {
    const weight = weightPerTribe(entry);
    for (const slug of entry.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Score a set of selected words into a normalized 0–1 value per tribe.
 *
 * Every one of the 12 tribes is always present in the result. A shared word
 * contributes its split weight (0.5 for a two-tribe word) to each mapped tribe;
 * each tribe's earned points are then divided by the points available to that
 * tribe across the whole list, so high- and low-coverage tribes compete fairly.
 * Unknown selections are ignored. The result is sorted by score descending,
 * ties broken by the canonical tribe order.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const byNormalizedWord = new Map<string, Word>();
  for (const entry of words) byNormalizedWord.set(normalize(entry.word), entry);

  const earned = new Map<string, number>();
  const seen = new Set<string>();
  for (const selection of selectedWords) {
    const key = normalize(selection);
    if (seen.has(key)) continue; // a word selected twice still counts once
    seen.add(key);
    const entry = byNormalizedWord.get(key);
    if (!entry) continue; // ignore words not on the list
    const weight = weightPerTribe(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const available = availablePointsByTribe();
  const order = new Map(tribes.map((t, i) => [t.slug, i]));

  return tribes
    .map((tribe) => {
      const avail = available.get(tribe.slug) ?? 0;
      const got = earned.get(tribe.slug) ?? 0;
      return { slug: tribe.slug, score: avail > 0 ? got / avail : 0 };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0);
    });
}

/**
 * Derive the headline result from scored tribes.
 *
 * The primary is always the highest-scoring tribe. A secondary is named only
 * when it is genuinely close to the primary (within
 * `SECONDARY_NEAR_PRIMARY_MARGIN`) *and* clearly ahead of the third tribe (the
 * third is at least `SECONDARY_AHEAD_OF_THIRD_MARGIN` below it); otherwise only
 * a primary is returned, keeping the result honest rather than forced.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const primary = ranked[0];
  const secondary = ranked[1];
  const third = ranked[2];

  if (!primary || primary.score <= 0 || !secondary || secondary.score <= 0) {
    return { primary };
  }

  const nearPrimary =
    secondary.score >= primary.score * (1 - SECONDARY_NEAR_PRIMARY_MARGIN);
  const aheadOfThird =
    !third ||
    third.score <= secondary.score * (1 - SECONDARY_AHEAD_OF_THIRD_MARGIN);

  return nearPrimary && aheadOfThird ? { primary, secondary } : { primary };
}
