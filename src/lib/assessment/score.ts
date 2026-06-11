import { tribes } from "@/lib/tribes";
import { words, wordWeight, type AssessmentWord } from "./words";

/**
 * Pure scoring core for the word-selection assessment.
 *
 * `score()` turns a set of selected words into a normalized 0–1 value for every
 * tribe (ADR-0001): the points a tribe earned divided by the total points
 * available to it across the whole word list, so a tribe with few words and a
 * tribe with many compete fairly. `deriveResult()` turns those scores into a
 * Primary tribe plus an optional Secondary.
 */

export interface TribeScore {
  /** Tribe slug. */
  slug: string;
  /** Raw points earned from the selection. */
  points: number;
  /** Total points available to this tribe across the full word list. */
  available: number;
  /** Normalized score in [0, 1] — `points / available` (0 when none available). */
  score: number;
}

export interface DerivedResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary is "near" the Primary only when it scores at least this fraction
 * of the Primary (i.e. within ~20%). Tunable.
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;

/**
 * A Secondary is "clearly ahead" of the third tribe only when the third scores
 * no more than this fraction of the Secondary (i.e. the Secondary leads the
 * third by ~20%). Tunable. Prevents naming a Secondary that is ~tied with #3.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** Total points available to each tribe across the full word list. */
function availablePointsByTribe(list: AssessmentWord[]): Map<string, number> {
  const available = new Map<string, number>();
  for (const t of tribes) available.set(t.slug, 0);
  for (const w of list) {
    const weight = wordWeight(w);
    for (const slug of w.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Score a selection of words. Returns a normalized score for every tribe (in
 * `tribes` order). Unknown words are ignored; duplicate selections count once.
 */
export function score(
  selectedWords: string[],
  list: AssessmentWord[] = words,
): TribeScore[] {
  const byWord = new Map(list.map((w) => [w.word, w]));
  const available = availablePointsByTribe(list);

  const points = new Map<string, number>();
  for (const t of tribes) points.set(t.slug, 0);

  for (const word of new Set(selectedWords)) {
    const w = byWord.get(word);
    if (!w) continue;
    const weight = wordWeight(w);
    for (const slug of w.tribes) {
      points.set(slug, (points.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((t) => {
    const earned = points.get(t.slug) ?? 0;
    const avail = available.get(t.slug) ?? 0;
    return {
      slug: t.slug,
      points: earned,
      available: avail,
      score: avail > 0 ? earned / avail : 0,
    };
  });
}

/**
 * Derive the Primary tribe (always the highest score) and an optional Secondary.
 * The Secondary is named only when it scores near the Primary AND is clearly
 * ahead of the third tribe; otherwise only a Primary is returned.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  const qualifies =
    !!secondary &&
    primary.score > 0 &&
    secondary.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO &&
    (!third || third.score <= secondary.score * SECONDARY_AHEAD_OF_THIRD_RATIO);

  return qualifies ? { primary, secondary } : { primary };
}
