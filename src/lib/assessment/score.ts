import { tribes } from "../tribes";
import { words, type WordMapping } from "./words";

/** A tribe's normalized standing for a given set of selected words. */
export interface TribeScore {
  tribeSlug: string;
  /** Raw points earned for this tribe from the selected words. */
  earned: number;
  /** Total points available for this tribe across the whole word list. */
  available: number;
  /** `earned / available`, a 0–1 value comparable across tribes (ADR-0001). */
  score: number;
}

/** The outcome of an assessment: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary qualifies only when it is near the Primary AND clearly ahead of
 * the third tribe. Both are tunable, relative thresholds (ADR-0001 leaves the
 * exact calibration to real data).
 */
export const SECONDARY_PROXIMITY = 0.2; // within 20% of the Primary
export const SECONDARY_THIRD_SEPARATION = 0.2; // 20% clear of the third tribe

/** Points a word contributes to each of its tribes: shared words split to 0.5. */
function weightPerTribe(word: WordMapping): number {
  return word.tribes.length === 1 ? 1 : 0.5;
}

/** Total points available per tribe across the entire word list. */
const availableByTribe: Map<string, number> = (() => {
  const totals = new Map<string, number>();
  for (const t of tribes) totals.set(t.slug, 0);
  for (const word of words) {
    const w = weightPerTribe(word);
    for (const slug of word.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + w);
    }
  }
  return totals;
})();

/** Tribe display order, used as a stable tie-break when scores are equal. */
const tribeOrder: Map<string, number> = new Map(
  tribes.map((t) => [t.slug, t.number]),
);

/**
 * Scores a set of selected words against every tribe. Returns one
 * normalized `TribeScore` per tribe, sorted by `score` descending (ties broken
 * by the tribe's canonical order). Unknown words are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const byWord = new Map(words.map((w) => [w.word, w]));
  const earned = new Map<string, number>();
  for (const t of tribes) earned.set(t.slug, 0);

  for (const selected of selectedWords) {
    const word = byWord.get(selected);
    if (!word) continue;
    const w = weightPerTribe(word);
    for (const slug of word.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + w);
    }
  }

  return tribes
    .map((t) => {
      const available = availableByTribe.get(t.slug) ?? 0;
      const earnedPoints = earned.get(t.slug) ?? 0;
      return {
        tribeSlug: t.slug,
        earned: earnedPoints,
        available,
        score: available > 0 ? earnedPoints / available : 0,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (tribeOrder.get(a.tribeSlug) ?? 0) - (tribeOrder.get(b.tribeSlug) ?? 0),
    );
}

/**
 * Derives the headline result from a scored list. The Primary is always the
 * top score. A Secondary is named only when it scores near the Primary and is
 * clearly ahead of the third tribe; otherwise only a Primary is returned.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, candidate, third] = ranked;

  if (!primary || primary.score <= 0 || !candidate || candidate.score <= 0) {
    return { primary };
  }

  const nearPrimary = candidate.score >= primary.score * (1 - SECONDARY_PROXIMITY);
  const aheadOfThird =
    !third || third.score < candidate.score * (1 - SECONDARY_THIRD_SEPARATION);

  return nearPrimary && aheadOfThird
    ? { primary, secondary: candidate }
    : { primary };
}
