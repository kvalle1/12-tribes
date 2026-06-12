import { tribes } from "@/lib/tribes";
import { words, type WordMapping } from "./words";

/**
 * Pure scoring core for the assessment (ADR-0001: normalized tribe scoring).
 *
 * A tribe's score is `points earned for that tribe ÷ total points available for
 * that tribe across the whole word list` — a 0–1 value comparable across tribes
 * regardless of how many words map to each. A shared word (mapped to more than
 * one tribe) contributes 0.5 to each; a solo word contributes a full point.
 *
 * This module is intentionally tiny and dependency-free so it can be reused
 * unchanged by the Self flow, the profile, and the 360 observer aggregation.
 */

export interface TribeScore {
  slug: string;
  name: string;
  /** Normalized 0–1 score for this tribe. */
  score: number;
}

export interface DerivedResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/** Weight a shared (multi-tribe) word contributes to each of its tribes. */
export const SHARED_WORD_WEIGHT = 0.5;

/**
 * Tunable result thresholds.
 * - `SECONDARY_PROXIMITY`: the Secondary must score within this fraction of the
 *   Primary (e.g. 0.2 ⇒ no more than 20% below Primary) to be "near" it.
 * - `THIRD_SEPARATION`: the Secondary must lead the third-place tribe by at
 *   least this fraction of its own score to be "clearly ahead" of it.
 */
export const SECONDARY_PROXIMITY = 0.2;
export const THIRD_SEPARATION = 0.2;

/** A solo word scores 1; any shared word scores 0.5 to each mapped tribe. */
function weightFor(mapping: WordMapping): number {
  return mapping.tribes.length === 1 ? 1 : SHARED_WORD_WEIGHT;
}

/**
 * Total points available per tribe across the entire word list — the
 * denominator that makes high- and low-coverage tribes compete fairly.
 */
export const availablePointsByTribe: Record<string, number> = (() => {
  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const mapping of words) {
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) totals[slug] += weight;
  }
  return totals;
})();

const mappingByWord = new Map(words.map((mapping) => [mapping.word, mapping]));

/**
 * Scores a set of selected words, returning a normalized 0–1 score for every
 * tribe in canonical (tribe `number`) order. Unknown or duplicate words are
 * ignored — a selection is a set.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned: Record<string, number> = {};
  for (const tribe of tribes) earned[tribe.slug] = 0;

  const seen = new Set<string>();
  for (const word of selectedWords) {
    if (seen.has(word)) continue;
    seen.add(word);
    const mapping = mappingByWord.get(word);
    if (!mapping) continue;
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) earned[slug] += weight;
  }

  return tribes.map((tribe) => {
    const available = availablePointsByTribe[tribe.slug];
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: available > 0 ? earned[tribe.slug] / available : 0,
    };
  });
}

/**
 * Derives the headline result from a set of tribe scores. Always returns a
 * Primary (the highest score). Returns a Secondary only when it both scores
 * near the Primary AND is clearly ahead of the third tribe — otherwise the
 * result is honestly Primary-only.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  // Stable sort by score desc; ties keep the input's canonical order.
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  if (!secondary || secondary.score === 0) {
    return { primary };
  }

  const nearPrimary =
    primary.score > 0 &&
    (primary.score - secondary.score) / primary.score <= SECONDARY_PROXIMITY;

  const aheadOfThird =
    !third ||
    third.score === 0 ||
    (secondary.score - third.score) / secondary.score >= THIRD_SEPARATION;

  return nearPrimary && aheadOfThird ? { primary, secondary } : { primary };
}
