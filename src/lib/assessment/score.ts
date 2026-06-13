import { tribes } from "../tribes";
import { words as defaultWords, type AssessmentWord } from "./words";

/**
 * Pure scoring core for the word-selection instrument.
 *
 * Scoring is **normalized** (ADR-0001): a Tribe score is the points a
 * respondent earned for that tribe divided by the total points available for
 * it across the whole word list. Because the word list maps unevenly to tribes
 * (some have 10 words, some 6), a raw sum would structurally favor high-
 * coverage tribes; normalizing by each tribe's available points lets every
 * tribe compete fairly and yields a 0–1 value comparable across tribes.
 *
 * A Shared word (mapped to more than one tribe) contributes half weight (0.5)
 * to each of its tribes; a sole-tribe word contributes full weight (1.0). That
 * 0.5 split is preserved as the per-word weight feeding the numerator and
 * denominator alike.
 *
 * Both functions are pure and take an optional `wordList` so behavior can be
 * exercised against synthetic data, not only the production list.
 */

const SHARED_WEIGHT = 0.5;
const SOLE_WEIGHT = 1.0;

/**
 * How close a Secondary must sit to the Primary to qualify: its score must be
 * within this fraction below the Primary's. Tunable.
 */
export const SECONDARY_NEAR_PRIMARY = 0.2;

/**
 * How clearly a Secondary must lead the third tribe to qualify: the third
 * tribe's score must sit at least this fraction below the Secondary's.
 * Prevents naming a Secondary that is effectively tied with the third. Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD = 0.2;

/** A tribe's normalized result. */
export interface TribeScore {
  /** Tribe slug (matches `tribes.ts`). */
  slug: string;
  /** Normalized score in [0, 1] — earned points ÷ available points. */
  score: number;
}

/** The outcome of an assessment: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/** Per-word weight: Shared words split 0.5 to each mapped tribe. */
function weightFor(word: AssessmentWord): number {
  return word.tribes.length > 1 ? SHARED_WEIGHT : SOLE_WEIGHT;
}

/** Canonical display order of tribes, used as a deterministic tie-breaker. */
const tribeOrder = new Map(tribes.map((t, i) => [t.slug, i] as const));

function orderKey(slug: string): number {
  const index = tribeOrder.get(slug);
  return index === undefined ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * Score a selection of words, returning a normalized score for every tribe
 * referenced by the word list, ranked highest-first.
 *
 * Unrecognized or duplicate selections are ignored: a word not in the list
 * contributes nothing, and selecting the same word twice counts once.
 *
 * Ties break by the tribe's canonical order (then slug) so the ranking is
 * stable and deterministic.
 */
export function score(
  selectedWords: string[],
  wordList: AssessmentWord[] = defaultWords,
): TribeScore[] {
  const available = new Map<string, number>();
  const byWord = new Map<string, AssessmentWord>();

  for (const entry of wordList) {
    byWord.set(entry.word, entry);
    const weight = weightFor(entry);
    for (const slug of entry.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }

  const earned = new Map<string, number>();
  for (const slug of available.keys()) earned.set(slug, 0);

  for (const selected of new Set(selectedWords)) {
    const entry = byWord.get(selected);
    if (!entry) continue;
    const weight = weightFor(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const scores: TribeScore[] = [];
  for (const [slug, total] of available) {
    scores.push({ slug, score: total > 0 ? (earned.get(slug) ?? 0) / total : 0 });
  }

  scores.sort(
    (a, b) =>
      b.score - a.score ||
      orderKey(a.slug) - orderKey(b.slug) ||
      a.slug.localeCompare(b.slug),
  );

  return scores;
}

/**
 * Derive the headline result from ranked scores.
 *
 * The Primary is always the highest-scoring tribe. A Secondary is named only
 * when it is genuinely close to the Primary (within {@link SECONDARY_NEAR_PRIMARY})
 * *and* clearly ahead of the third tribe (the third sits at least
 * {@link SECONDARY_AHEAD_OF_THIRD} below it) — otherwise the result names only
 * a Primary, keeping it honest rather than forcing a runner-up.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("Cannot derive a result from an empty score list.");
  }

  const [primary, secondary, third] = scores;
  if (!secondary || primary.score <= 0 || secondary.score <= 0) {
    return { primary };
  }

  const nearPrimary =
    (primary.score - secondary.score) / primary.score <= SECONDARY_NEAR_PRIMARY;

  const thirdScore = third?.score ?? 0;
  const aheadOfThird =
    (secondary.score - thirdScore) / secondary.score >= SECONDARY_AHEAD_OF_THIRD;

  return nearPrimary && aheadOfThird ? { primary, secondary } : { primary };
}
