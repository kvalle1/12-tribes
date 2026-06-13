import { tribes } from "@/lib/tribes";
import { wordMappings, wordWeight, type WordMapping } from "./words";

/**
 * Pure scoring core for the Self Assessment.
 *
 * `score(selectedWords)` returns a normalized 0–1 score for every tribe, and
 * `deriveResult(scores)` distills those into a Primary tribe and an optional
 * Secondary. Both are pure and free of UI/persistence concerns so the 360 layer
 * can reuse them unchanged (ADR-0001).
 */

/** A tribe's normalized result. `score` ranges 0–1. */
export interface TribeScore {
  /** Tribe slug, matching `tribes[].slug`. */
  slug: string;
  /** Points earned for this tribe ÷ points available for it across the whole list. */
  score: number;
}

/** The distilled outcome of an assessment. */
export interface AssessmentResult {
  /** Highest-scoring tribe. Always present. */
  primary: string;
  /** Close runner-up, present only when it qualifies (see thresholds below). */
  secondary?: string;
}

/**
 * Secondary must score within this fraction of the Primary to count as "near"
 * it — i.e. no more than 20% below the Primary.
 */
export const SECONDARY_PROXIMITY_TO_PRIMARY = 0.2;
/**
 * Secondary must lead the third tribe by at least this fraction to count as
 * "clearly ahead" — a Secondary roughly tied with the third tribe is suppressed.
 */
export const SECONDARY_LEAD_OVER_THIRD = 0.2;

/**
 * Total points available for each tribe across the whole word list — the
 * normalization denominator. Computed once from the static word data.
 */
function availablePointsByTribe(): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tribe of tribes) totals.set(tribe.slug, 0);
  for (const mapping of wordMappings) {
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
}

const AVAILABLE_POINTS = availablePointsByTribe();

/**
 * Score a set of selected words. Returns a `TribeScore` for every tribe in
 * `tribes` order. Unknown or duplicate words are ignored. A shared word
 * contributes 0.5 to each of its tribes; a solo word contributes 1.0. Each
 * tribe's raw points are divided by the points available for it, so tribes with
 * different word coverage compete fairly.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const mappingByWord = new Map<string, WordMapping>(
    wordMappings.map((m) => [m.word, m]),
  );
  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  const counted = new Set<string>();
  for (const word of selectedWords) {
    const mapping = mappingByWord.get(word);
    if (!mapping || counted.has(word)) continue;
    counted.add(word);
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const available = AVAILABLE_POINTS.get(tribe.slug) ?? 0;
    const points = earned.get(tribe.slug) ?? 0;
    return { slug: tribe.slug, score: available === 0 ? 0 : points / available };
  });
}

/**
 * Distill tribe scores into a Primary (always) and an optional Secondary.
 * Secondary is named only when it scores near the Primary AND clearly ahead of
 * the third tribe; otherwise only a Primary is returned.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  const result: AssessmentResult = { primary: primary.slug };

  if (!secondary || secondary.score <= 0) return result;

  const nearPrimary =
    secondary.score >= primary.score * (1 - SECONDARY_PROXIMITY_TO_PRIMARY);
  const thirdScore = third?.score ?? 0;
  const clearlyAheadOfThird =
    thirdScore <= secondary.score * (1 - SECONDARY_LEAD_OVER_THIRD);

  if (nearPrimary && clearlyAheadOfThird) {
    result.secondary = secondary.slug;
  }
  return result;
}
