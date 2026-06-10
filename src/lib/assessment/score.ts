import { tribes } from "../tribes";
import { assessmentWords, type AssessmentWord } from "./words";

/**
 * Pure scoring core for the word-selection assessment (ADR-0001).
 *
 * Scoring is *normalized*: a tribe's score is the points it earned from the
 * selected words divided by the total points available for it across the whole
 * word list — a 0–1 value comparable across tribes regardless of how many words
 * map to each (a 6-word tribe and a 10-word tribe compete fairly). A shared
 * word (mapped to more than one tribe) contributes 0.5 to each of its tribes;
 * a word mapped to a single tribe contributes a full point.
 */

/** A single full point for a single-tribe word; 0.5 per tribe for a shared word. */
const WEIGHT_SINGLE = 1;
const WEIGHT_SHARED = 0.5;

/** Secondary must score at least this fraction of the Primary to be "near" it. */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
/** Third place must be at or below this fraction of the Secondary ("clearly ahead"). */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

export interface TribeScore {
  /** Tribe slug, matching `tribes`. */
  slug: string;
  /** Normalized score in [0, 1] — `earned / available` (0 when nothing available). */
  score: number;
  /** Raw points earned from the selected words. */
  earned: number;
  /** Total points available for this tribe across the whole word list. */
  available: number;
}

export interface AssessmentResult {
  primary: TribeScore;
  /** Present only when a genuine Secondary applies (see `deriveResult`). */
  secondary?: TribeScore;
}

function weightOf(entry: AssessmentWord): number {
  return entry.tribes.length > 1 ? WEIGHT_SHARED : WEIGHT_SINGLE;
}

/** Sum the per-mapping weight each tribe could earn from the entire word list. */
function availablePoints(): Map<string, number> {
  const available = new Map<string, number>();
  for (const tribe of tribes) available.set(tribe.slug, 0);
  for (const entry of assessmentWords) {
    const weight = weightOf(entry);
    for (const slug of entry.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Score a selection of words, returning a normalized score for every tribe in
 * `tribes` order. Words not present in the list are ignored; duplicate
 * selections count once.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const available = availablePoints();
  const byWord = new Map(assessmentWords.map((entry) => [entry.word, entry]));

  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  for (const word of new Set(selectedWords)) {
    const entry = byWord.get(word);
    if (!entry) continue;
    const weight = weightOf(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const earnedPoints = earned.get(tribe.slug) ?? 0;
    const availablePointsForTribe = available.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      earned: earnedPoints,
      available: availablePointsForTribe,
      score: availablePointsForTribe > 0 ? earnedPoints / availablePointsForTribe : 0,
    };
  });
}

/**
 * Derive the headline result from a set of tribe scores. Primary is always the
 * highest-scoring tribe. A Secondary is returned only when it scores *near* the
 * Primary (within `SECONDARY_NEAR_PRIMARY_RATIO`) AND is *clearly ahead* of the
 * third tribe (third at or below `SECONDARY_AHEAD_OF_THIRD_RATIO` of it);
 * otherwise only a Primary is named. Ties break by tribe order for determinism.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const order = new Map(tribes.map((tribe, index) => [tribe.slug, index]));
  const ranked = [...scores].sort(
    (a, b) =>
      b.score - a.score ||
      (order.get(a.slug) ?? Infinity) - (order.get(b.slug) ?? Infinity),
  );

  const primary = ranked[0];
  const candidate = ranked[1];
  const third = ranked[2];

  const nearPrimary =
    candidate !== undefined &&
    primary.score > 0 &&
    candidate.score > 0 &&
    candidate.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO;

  const clearlyAheadOfThird =
    third === undefined || third.score <= (candidate?.score ?? 0) * SECONDARY_AHEAD_OF_THIRD_RATIO;

  if (nearPrimary && clearlyAheadOfThird) {
    return { primary, secondary: candidate };
  }
  return { primary };
}
