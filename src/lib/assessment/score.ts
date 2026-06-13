import { tribes } from "@/lib/tribes";
import { words, wordWeight, type AssessmentWord } from "@/lib/assessment/words";

/**
 * Pure scoring core for the word-selection assessment.
 *
 * `score()` turns a set of selected words into a normalized 0–1 strength score
 * for every tribe; `deriveResult()` turns those scores into a Primary tribe and
 * an optional Secondary. Both are pure and free of UI, persistence, and auth so
 * the 360 layer can reuse them unchanged (ADR-0001, PRD #3 / issue #4).
 */

/** A single tribe's normalized strength score. */
export interface TribeScore {
  /** Tribe slug (matches `tribes.ts`). */
  slug: string;
  /**
   * Normalized score in `[0, 1]`: points earned for this tribe divided by the
   * total points available for it across the whole word list (ADR-0001), so
   * tribes with more or fewer mapped words still compete fairly.
   */
  score: number;
}

/** The headline result: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary is shown only when it scores within this fraction of the
 * Primary — i.e. `secondary >= primary * (1 - SECONDARY_MAX_GAP_FROM_PRIMARY)`.
 * Tunable (PRD: "≈ within 20%").
 */
export const SECONDARY_MAX_GAP_FROM_PRIMARY = 0.2;

/**
 * A Secondary is shown only when it is clearly ahead of the third tribe —
 * i.e. `third <= secondary * (1 - SECONDARY_MIN_GAP_FROM_THIRD)`. Tunable.
 */
export const SECONDARY_MIN_GAP_FROM_THIRD = 0.2;

/** Total points available for each tribe across the whole word list. */
function pointsAvailableByTribe(): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tribe of tribes) totals.set(tribe.slug, 0);

  for (const entry of words) {
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
}

/**
 * Score the selected words, returning a normalized strength score for every
 * tribe, sorted from highest to lowest (ties broken by tribe number for
 * determinism). Words not in the list are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const byWord = new Map<string, AssessmentWord>(
    words.map((entry) => [entry.word, entry]),
  );
  const available = pointsAvailableByTribe();

  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  for (const selected of new Set(selectedWords)) {
    const entry = byWord.get(selected);
    if (!entry) continue;
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const numberBySlug = new Map(tribes.map((t) => [t.slug, t.number]));

  return tribes
    .map((tribe) => {
      const avail = available.get(tribe.slug) ?? 0;
      const got = earned.get(tribe.slug) ?? 0;
      return { slug: tribe.slug, score: avail > 0 ? got / avail : 0 };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (numberBySlug.get(a.slug) ?? 0) - (numberBySlug.get(b.slug) ?? 0);
    });
}

/**
 * Derive the headline result from scored tribes. The Primary is always the
 * highest-scoring tribe. A Secondary is returned only when it scores near the
 * Primary AND is clearly ahead of the third tribe — otherwise only a Primary is
 * named, so the result stays honest rather than forced.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const primary = sorted[0];
  const candidate = sorted[1];
  const third = sorted[2];

  if (!candidate || candidate.score <= 0) {
    return { primary };
  }

  const nearPrimary =
    candidate.score >= primary.score * (1 - SECONDARY_MAX_GAP_FROM_PRIMARY);
  const aheadOfThird =
    !third || third.score <= candidate.score * (1 - SECONDARY_MIN_GAP_FROM_THIRD);

  return nearPrimary && aheadOfThird
    ? { primary, secondary: candidate }
    : { primary };
}
