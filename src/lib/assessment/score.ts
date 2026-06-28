import { tribes } from "@/lib/tribes";
import { WORDS, type AssessmentWord } from "./words";

/**
 * Pure scoring core for the Tribe Index assessment (ADR-0001: normalized tribe
 * scoring; ADR-0002: the Strength Profile is the shared output shape).
 *
 * A tribe's score is `points earned for that tribe ÷ total points available for
 * that tribe across the whole word list` — a normalized 0–1 value comparable
 * across tribes regardless of how many words map to each, so a 6-word tribe and
 * a 10-word tribe compete fairly.
 *
 * A word shared across N tribes contributes 1/N to each (0.5 each for the common
 * two-tribe case, 1/3 each for the three-tribe "Zealous"). This 1/N rule
 * conserves exactly one point per selected word, so the normalization denominator
 * and numerator stay on the same scale no matter the sharing.
 *
 * The module is intentionally tiny and dependency-free so it can be reused
 * unchanged by the Self flow, the profile, and the 360 observer aggregation.
 */

export interface TribeScore {
  slug: string;
  name: string;
  /** Normalized 0–1 score for this tribe. */
  score: number;
}

export interface DerivedResult {
  /** Always present — the best-fitting tribe. */
  primary: TribeScore;
  /** Present only when a second tribe is near the Primary and clearly ahead of the third. */
  secondary?: TribeScore;
}

/**
 * Tunable result thresholds.
 * - `SECONDARY_PROXIMITY`: the Secondary must score within this fraction of the
 *   Primary (e.g. 0.2 ⇒ no more than 20% below Primary) to count as "near" it.
 * - `THIRD_SEPARATION`: the Secondary must lead the third-place tribe by at least
 *   this fraction of its own score to count as "clearly ahead" of it.
 */
export const SECONDARY_PROXIMITY = 0.2;
export const THIRD_SEPARATION = 0.2;

/**
 * The point a word contributes, split evenly across the tribes it maps to:
 * 1.0 for a single-tribe word, 0.5 each for a two-tribe word, 1/3 each for the
 * three-tribe word ("Zealous"). Conserves one point per word.
 */
function wordWeight(word: AssessmentWord): number {
  return 1 / word.tribes.length;
}

/**
 * Total points available per tribe across the entire word list — the denominator
 * that makes high- and low-coverage tribes compete fairly (ADR-0001).
 */
export const availablePointsByTribe: Record<string, number> = (() => {
  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const word of WORDS) {
    const weight = wordWeight(word);
    for (const slug of word.tribes) totals[slug] += weight;
  }
  return totals;
})();

const wordByName = new Map(WORDS.map((word) => [word.word, word]));

/**
 * Score a set of selected words, returning a normalized 0–1 score for every
 * tribe in canonical (tribe `number`) order. A selection is a set: unknown words
 * and duplicates are ignored, and matching is exact (case-sensitive).
 */
export function score(selectedWords: readonly string[]): TribeScore[] {
  const earned: Record<string, number> = {};
  for (const tribe of tribes) earned[tribe.slug] = 0;

  const seen = new Set<string>();
  for (const name of selectedWords) {
    if (seen.has(name)) continue;
    seen.add(name);
    const word = wordByName.get(name);
    if (!word) continue;
    const weight = wordWeight(word);
    for (const slug of word.tribes) earned[slug] += weight;
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

export interface RankedTribeScore extends TribeScore {
  /**
   * Bar width as a 0–1 fraction of the top-scoring tribe's score, so the
   * leader fills the bar and the rest stay proportional to it. Ratios between
   * bars equal the ratios between normalized scores. 0 for every tribe when
   * nothing scored (no divide-by-zero).
   */
  barFraction: number;
}

/**
 * Rank a set of tribe scores highest-first for the result view's proportional
 * bars (issue #6). Ranking ties keep canonical (tribe `number`) order — the same
 * stable ordering `deriveResult` uses — so the Primary always heads the list.
 * Pure: takes scores and returns a view model, no DB or content lookups.
 */
export function rankForDisplay(scores: TribeScore[]): RankedTribeScore[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;
  return ranked.map((s) => ({
    ...s,
    barFraction: max > 0 ? s.score / max : 0,
  }));
}

/**
 * Derive the headline result from a set of tribe scores. Always returns a
 * Primary (the highest score). Returns a Secondary only when it both scores near
 * the Primary AND is clearly ahead of the third tribe — otherwise the result is
 * honestly Primary-only. Ranking ties keep canonical (tribe `number`) order, so
 * the outcome is deterministic.
 *
 * Note: this instrument (the Self / 360 word selection, issue #4) reports a
 * single Primary plus an optional Secondary by design. The co-Primaries set in
 * ADR-0006 governs the separate Interview instrument's stop condition, not this
 * one.
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
