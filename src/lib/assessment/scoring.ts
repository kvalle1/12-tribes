import { tribes } from "../tribes";
import { words, type WordEntry } from "./words";

/**
 * Pure scoring core for the Tribe Index assessment.
 *
 * Scoring is normalized (ADR-0001): a tribe's score is the points it earned from
 * the selected words divided by the total points available to it across the whole
 * word list, so a 6-word tribe and a 10-word tribe compete fairly. A shared word
 * (mapped to more than one tribe) contributes 0.5 to each of its tribes — that
 * 0.5 weight feeds both the numerator (earned) and the denominator (available).
 */

/** A normalized 0–1 score for every tribe, keyed by slug. */
export type TribeScores = Record<string, number>;

export interface AssessmentResult {
  /** Slug of the Primary tribe. Always present. */
  primary: string;
  /** Slug of the Secondary tribe, or null when no tribe qualifies. */
  secondary: string | null;
}

/**
 * How close (as a fraction) the Secondary must be to the Primary to qualify,
 * and how far ahead of the third tribe it must sit. A Secondary is shown only
 * when it scores within 20% of the Primary *and* the third tribe is at least
 * 20% behind it.
 */
const SECONDARY_NEAR_RATIO = 0.8;

/** Points a single word contributes to each tribe it maps to. */
function weightPerTribe(entry: WordEntry): number {
  return entry.tribes.length > 1 ? 0.5 : 1;
}

/** Total points available to each tribe across the entire word list. */
function availablePoints(): TribeScores {
  const available: TribeScores = {};
  for (const t of tribes) available[t.slug] = 0;
  for (const entry of words) {
    const weight = weightPerTribe(entry);
    for (const slug of entry.tribes) available[slug] += weight;
  }
  return available;
}

/**
 * Score a set of selected words, returning a normalized 0–1 value per tribe.
 * Unknown words (not on the list) are ignored.
 */
export function score(selectedWords: string[]): TribeScores {
  const selected = new Set(selectedWords);
  const available = availablePoints();

  const earned: TribeScores = {};
  for (const t of tribes) earned[t.slug] = 0;
  for (const entry of words) {
    if (!selected.has(entry.word)) continue;
    const weight = weightPerTribe(entry);
    for (const slug of entry.tribes) earned[slug] += weight;
  }

  const scores: TribeScores = {};
  for (const t of tribes) {
    const total = available[t.slug];
    scores[t.slug] = total > 0 ? earned[t.slug] / total : 0;
  }
  return scores;
}

/**
 * Derive the Primary (and optional Secondary) tribe from a set of scores.
 *
 * Always returns a Primary — the highest-scoring tribe, breaking ties by tribe
 * number for determinism. Returns a Secondary only when it scores near the
 * Primary (within {@link SECONDARY_NEAR_RATIO}) and is clearly ahead of the
 * third tribe.
 */
export function deriveResult(scores: TribeScores): AssessmentResult {
  const ranked = tribes
    .map((t) => ({ slug: t.slug, number: t.number, value: scores[t.slug] ?? 0 }))
    .sort((a, b) => b.value - a.value || a.number - b.number);

  const [primary, second, third] = ranked;

  const secondaryQualifies =
    primary.value > 0 &&
    second !== undefined &&
    second.value >= primary.value * SECONDARY_NEAR_RATIO &&
    (third === undefined || third.value <= second.value * SECONDARY_NEAR_RATIO);

  return {
    primary: primary.slug,
    secondary: secondaryQualifies ? second.slug : null,
  };
}
