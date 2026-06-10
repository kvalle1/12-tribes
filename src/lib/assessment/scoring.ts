import { tribes } from "../tribes";
import { WORDS, type AssessmentWord } from "./words";

/** A normalized score in [0, 1] for every tribe, keyed by tribe slug. */
export type TribeScores = Record<string, number>;

export interface AssessmentResult {
  /** Always present — the best-fitting tribe. */
  primary: string;
  /** Present only when a second tribe is near the primary and clearly ahead of the third. */
  secondary: string | null;
}

/**
 * A Secondary is offered only when it scores within this fraction of the
 * Primary (≈ within 20%) and is itself clearly ahead of the third tribe by the
 * same margin. Symmetric thresholds keep "near the primary" and "clearly ahead
 * of the third" consistent.
 */
const SECONDARY_MARGIN = 0.2;

/**
 * The point a word contributes, split evenly across the tribes it maps to:
 * 1.0 for a single-tribe word, 0.5 each for a two-tribe shared word, 1/3 each
 * for the three-tribe word ("Zealous").
 */
function wordWeight(word: AssessmentWord): number {
  return 1 / word.tribes.length;
}

/**
 * Total points available for each tribe across the whole word list — the
 * denominator that makes normalization coverage-fair, so a tribe with 6 words
 * and one with 10 words compete on the same 0–1 scale (ADR-0001).
 */
const availablePoints: TribeScores = (() => {
  const totals: TribeScores = {};
  for (const t of tribes) totals[t.slug] = 0;
  for (const word of WORDS) {
    const weight = wordWeight(word);
    for (const slug of word.tribes) totals[slug] += weight;
  }
  return totals;
})();

/**
 * Score a set of selected words. Returns a normalized 0–1 value for every tribe:
 * the points the selection earned for that tribe divided by the total points
 * available for it. A shared word contributes its split weight (0.5 for a
 * two-tribe word) to each of its tribes.
 */
export function score(selectedWords: readonly string[]): TribeScores {
  const selected = new Set(selectedWords);
  const earned: TribeScores = {};
  for (const t of tribes) earned[t.slug] = 0;

  for (const word of WORDS) {
    if (!selected.has(word.word)) continue;
    const weight = wordWeight(word);
    for (const slug of word.tribes) earned[slug] += weight;
  }

  const scores: TribeScores = {};
  for (const t of tribes) {
    const available = availablePoints[t.slug];
    scores[t.slug] = available > 0 ? earned[t.slug] / available : 0;
  }
  return scores;
}

/**
 * Derive the Primary (and optional Secondary) tribe from a score map. Always
 * returns a Primary. A Secondary is returned only when it scores within
 * `SECONDARY_MARGIN` of the Primary AND is more than `SECONDARY_MARGIN` ahead of
 * the third tribe — so it is hidden both when far behind the Primary and when
 * roughly tied with the third. Ranking ties break deterministically by tribe
 * number.
 */
export function deriveResult(scores: TribeScores): AssessmentResult {
  const ranked = tribes
    .map((t) => ({ slug: t.slug, number: t.number, value: scores[t.slug] ?? 0 }))
    .sort((a, b) => b.value - a.value || a.number - b.number);

  const [primary, second, third] = ranked;

  const nearPrimary = second.value >= primary.value * (1 - SECONDARY_MARGIN);
  const aheadOfThird = third.value <= second.value * (1 - SECONDARY_MARGIN);

  const hasSecondary =
    primary.value > 0 && second.value > 0 && nearPrimary && aheadOfThird;

  return {
    primary: primary.slug,
    secondary: hasSecondary ? second.slug : null,
  };
}
