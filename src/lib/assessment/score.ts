import { tribes } from "../tribes";
import { words, type AssessmentWord } from "./words";

/** A tribe's normalized assessment result. `score` ranges 0–1 (see ADR-0001). */
export interface TribeScore {
  slug: string;
  score: number;
}

/** The outcome of an assessment: a primary tribe and an optional secondary. */
export interface DerivedResult {
  primary: string;
  secondary: string | null;
}

/**
 * Secondary must score at least this fraction of the primary's score to count
 * as "near" it (≈ within 20%). Tunable.
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;

/**
 * Secondary must be clearly ahead of the third tribe: the third may be at most
 * this fraction of the secondary's score. Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** Weight a single word contributes to each of its tribes (1/n equal split). */
function weightOf(word: AssessmentWord): number {
  return 1 / word.tribes.length;
}

/**
 * Total points available for each tribe across the whole word list — the
 * normalization denominator. Computed once from the word data.
 */
const totalPointsByTribe: Map<string, number> = (() => {
  const totals = new Map<string, number>();
  for (const t of tribes) totals.set(t.slug, 0);
  for (const w of words) {
    const weight = weightOf(w);
    for (const slug of w.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
})();

/**
 * Scores a set of selected words, returning a normalized 0–1 value for every
 * tribe (ADR-0001): the points earned for the tribe divided by the total points
 * available for it. A word shared across `n` tribes contributes `1/n` to each.
 * Unknown and duplicate selections are ignored. Order matches `tribes`.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords);
  const wordByName = new Map(words.map((w) => [w.word, w]));

  const earned = new Map<string, number>();
  for (const t of tribes) earned.set(t.slug, 0);

  for (const name of selected) {
    const w = wordByName.get(name);
    if (!w) continue;
    const weight = weightOf(w);
    for (const slug of w.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((t) => {
    const total = totalPointsByTribe.get(t.slug) ?? 0;
    return {
      slug: t.slug,
      score: total === 0 ? 0 : (earned.get(t.slug) ?? 0) / total,
    };
  });
}

const tribeNumberBySlug = new Map(tribes.map((t) => [t.slug, t.number]));

/** Tribe scores sorted highest-first, with a deterministic tie-break. */
export function rankTribeScores(scores: TribeScore[]): TribeScore[] {
  return [...scores].sort(
    (a, b) =>
      b.score - a.score ||
      (tribeNumberBySlug.get(a.slug) ?? 0) - (tribeNumberBySlug.get(b.slug) ?? 0),
  );
}

/**
 * Derives the result from tribe scores. The primary is always the highest
 * scorer. A secondary is named only when it scores near the primary AND is
 * clearly ahead of the third tribe — otherwise the result names a primary only.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  const ranked = rankTribeScores(scores);
  const [primary, second, third] = ranked;

  let secondary: string | null = null;
  if (primary && second && primary.score > 0 && second.score > 0) {
    const nearPrimary =
      second.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO;
    const aheadOfThird =
      !third || third.score <= second.score * SECONDARY_AHEAD_OF_THIRD_RATIO;
    if (nearPrimary && aheadOfThird) secondary = second.slug;
  }

  return { primary: primary?.slug ?? "", secondary };
}
