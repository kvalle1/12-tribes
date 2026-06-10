import { tribes } from "@/lib/tribes";
import { words, type WordMapping } from "./words";

/**
 * A normalized score per tribe, keyed by tribe `slug`. Every tribe is present;
 * each value is in the range 0–1.
 */
export type TribeScores = Record<string, number>;

/**
 * The outcome of an assessment: always a Primary tribe, and a Secondary only
 * when it qualifies (see {@link deriveResult}). Both are tribe slugs.
 */
export interface AssessmentResult {
  primary: string;
  secondary?: string;
}

/**
 * A Secondary qualifies only when it scores within 20% of the Primary, i.e.
 * `secondary >= primary * SECONDARY_NEAR_PRIMARY`.
 */
export const SECONDARY_NEAR_PRIMARY = 0.8;

/**
 * ...and is clearly ahead of the third tribe, i.e. the third tribe scores no
 * more than 80% of the Secondary (`third <= secondary * SECONDARY_AHEAD_OF_THIRD`).
 * If the Secondary is roughly tied with the third tribe, no Secondary is shown.
 */
export const SECONDARY_AHEAD_OF_THIRD = 0.8;

/**
 * Points a single selected word contributes to each of its mapped tribes.
 *
 * A word is worth one point total, split evenly across the tribes it maps to:
 * `1 / tribes.length`. So a solo word gives 1.0, a two-tribe ("shared") word
 * gives 0.5 to each (per ADR-0001 / ASSESSMENT_DESIGN.md), and the lone
 * three-tribe word ("Zealous") gives 1/3 to each.
 */
function wordWeight(entry: WordMapping): number {
  return 1 / entry.tribes.length;
}

/**
 * Total points available to each tribe across the entire word list — the
 * denominator for normalization. Computed once from `words`.
 */
const availablePoints: TribeScores = (() => {
  const totals: TribeScores = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const entry of words) {
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      totals[slug] = (totals[slug] ?? 0) + weight;
    }
  }
  return totals;
})();

/** Lookup of word → mapping for the canonical word strings. */
const wordIndex: Map<string, WordMapping> = new Map(
  words.map((entry) => [entry.word, entry]),
);

/**
 * Score a set of selected words into a normalized 0–1 value per tribe.
 *
 * Scoring is normalized (ADR-0001): a tribe's score is the points it earned
 * divided by the total points available to it across the whole word list, so a
 * tribe with few words and a tribe with many compete fairly. A shared word
 * splits its point evenly across its tribes (see {@link wordWeight}).
 *
 * Words not present in the list are ignored, and duplicate selections of the
 * same word are counted once.
 */
export function score(selectedWords: readonly string[]): TribeScores {
  const earned: TribeScores = {};
  for (const tribe of tribes) earned[tribe.slug] = 0;

  const counted = new Set<string>();
  for (const word of selectedWords) {
    if (counted.has(word)) continue;
    const entry = wordIndex.get(word);
    if (!entry) continue;
    counted.add(word);
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      earned[slug] = (earned[slug] ?? 0) + weight;
    }
  }

  const scores: TribeScores = {};
  for (const tribe of tribes) {
    const available = availablePoints[tribe.slug] ?? 0;
    scores[tribe.slug] = available > 0 ? earned[tribe.slug] / available : 0;
  }
  return scores;
}

/**
 * Derive the Primary (and optional Secondary) tribe from a set of scores.
 *
 * Always returns a Primary — the highest-scoring tribe, ties broken by the
 * tribe's canonical `number` for determinism. A Secondary is returned only when
 * it is near the Primary (within 20%) and clearly ahead of the third tribe; if
 * it is roughly tied with the third, or no real signal exists, it is omitted.
 */
export function deriveResult(scores: TribeScores): AssessmentResult {
  const ranked = tribes
    .map((tribe) => ({
      slug: tribe.slug,
      number: tribe.number,
      score: scores[tribe.slug] ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.number - b.number);

  const [primary, secondary, third] = ranked;
  const result: AssessmentResult = { primary: primary.slug };

  const qualifies =
    secondary !== undefined &&
    secondary.score > 0 &&
    secondary.score >= primary.score * SECONDARY_NEAR_PRIMARY &&
    (third === undefined ||
      third.score <= secondary.score * SECONDARY_AHEAD_OF_THIRD);

  if (qualifies) result.secondary = secondary.slug;
  return result;
}
