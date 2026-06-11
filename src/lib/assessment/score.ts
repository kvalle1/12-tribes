import { tribes, getTribeBySlug } from "@/lib/tribes";
import { words, type WordMapping } from "@/lib/assessment/words";

/**
 * The pure scoring core for the Self Assessment.
 *
 * Scoring is **normalized** (ADR-0001): a tribe's score is the points it earned
 * divided by the total points available for it across the whole word list, so a
 * 6-word tribe and a 10-word tribe compete fairly. A word contributes a total
 * weight of 1.0 split equally among the tribes it maps to — so a Shared (two-tribe)
 * word contributes 0.5 to each, the three-tribe word contributes 1/3 to each, and
 * a single-tribe word contributes the full 1.0.
 */

/** A single tribe's normalized result. `score` ranges 0–1. */
export interface TribeScore {
  slug: string;
  score: number;
}

/** The derived headline: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * The Secondary is shown only when it scores *near* the Primary. Tunable: the
 * Secondary's score must be at least this fraction of the Primary's. ("≈ within
 * 20%" of the Primary.)
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;

/**
 * ...and only when it is *clearly ahead* of the third tribe. Tunable: the third
 * tribe's score must be at most this fraction of the Secondary's, otherwise the
 * Secondary is treated as ~tied with the pack and suppressed.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** The weight a word contributes to each tribe it maps to (splits 1.0 equally). */
function weightPerTribe(mapping: WordMapping): number {
  return 1 / mapping.tribes.length;
}

/**
 * Total points available for each tribe across the entire word list — the
 * denominator that normalizes scores. Computed once from the word data.
 */
const availablePointsBySlug: Map<string, number> = (() => {
  const totals = new Map<string, number>();
  for (const tribe of tribes) totals.set(tribe.slug, 0);
  for (const mapping of words) {
    const weight = weightPerTribe(mapping);
    for (const slug of mapping.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
})();

/** Case-insensitive lookup from a display word to its mapping. */
const mappingByWord: Map<string, WordMapping> = new Map(
  words.map((mapping) => [mapping.word.toLowerCase(), mapping]),
);

/**
 * Score a set of selected words into a normalized 0–1 value for every one of the
 * 12 tribes, sorted highest-first (ties broken by tribe number for stability).
 * Unrecognized words are ignored; duplicate selections count once.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  const seen = new Set<string>();
  for (const raw of selectedWords) {
    const key = raw.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const mapping = mappingByWord.get(key);
    if (!mapping) continue;

    const weight = weightPerTribe(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes
    .map((tribe) => {
      const available = availablePointsBySlug.get(tribe.slug) ?? 0;
      const points = earned.get(tribe.slug) ?? 0;
      return { slug: tribe.slug, score: available > 0 ? points / available : 0 };
    })
    .sort(byScoreThenTribeNumber);
}

/**
 * Derive the headline result. Always names a Primary (the highest score). Names a
 * Secondary only when it scores near the Primary AND clearly ahead of the third
 * tribe; otherwise the result is Primary-only.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort(byScoreThenTribeNumber);
  const primary = ranked[0];
  const secondary = ranked[1];
  const third = ranked[2];

  const qualifies =
    secondary !== undefined &&
    primary.score > 0 &&
    secondary.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO &&
    (third === undefined ||
      third.score <= secondary.score * SECONDARY_AHEAD_OF_THIRD_RATIO);

  return qualifies ? { primary, secondary } : { primary };
}

/** Sort comparator: score descending, then tribe number ascending for stability. */
function byScoreThenTribeNumber(a: TribeScore, b: TribeScore): number {
  if (b.score !== a.score) return b.score - a.score;
  const an = getTribeBySlug(a.slug)?.number ?? Number.MAX_SAFE_INTEGER;
  const bn = getTribeBySlug(b.slug)?.number ?? Number.MAX_SAFE_INTEGER;
  return an - bn;
}
