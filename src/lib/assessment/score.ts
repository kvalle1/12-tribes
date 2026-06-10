import { tribes } from "@/lib/tribes";
import { words, type WordEntry } from "@/lib/assessment/words";

/** A tribe's normalized fit score (0–1) for a given selection. */
export interface TribeScore {
  slug: string;
  score: number;
}

/** The headline result: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * Thresholds governing whether a Secondary tribe is surfaced. Tunable; ship
 * with reasonable defaults (PRD: Secondary shown only when near Primary AND
 * clearly ahead of the third).
 *
 * - `SECONDARY_NEAR_PRIMARY` — the Secondary must score within this fraction
 *   below the Primary (0.2 ⇒ "within 20%").
 * - `SECONDARY_AHEAD_OF_THIRD` — the third tribe must fall at least this
 *   fraction below the Secondary, so a Secondary that is ~tied with the third
 *   is suppressed.
 */
export const SECONDARY_NEAR_PRIMARY = 0.2;
export const SECONDARY_AHEAD_OF_THIRD = 0.2;

/**
 * The scoring weight a single word contributes to *each* tribe it maps to. A
 * solo word contributes a full point; a shared word contributes 0.5 to each of
 * its tribes (ADR-0001). This is the per-word weight that feeds the numerator;
 * the final tribe score is normalized by available points below.
 */
export function wordWeight(entry: WordEntry): number {
  return entry.tribes.length === 1 ? 1 : 0.5;
}

/**
 * Total points available for each tribe across the whole word list — the
 * normalization denominator. A tribe's score is the points a respondent earned
 * for it divided by this, so a 6-word tribe and a 10-word tribe compete fairly
 * regardless of coverage (ADR-0001).
 */
function availablePointsByTribe(): Map<string, number> {
  const available = new Map<string, number>();
  for (const t of tribes) available.set(t.slug, 0);
  for (const entry of words) {
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Scores a selection of words, returning a normalized 0–1 fit score for every
 * one of the 12 tribes. Unknown words (not in the list) contribute nothing.
 * The returned array is sorted by score descending, ties broken by the tribe's
 * canonical `number`, so ordering is deterministic.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const available = availablePointsByTribe();
  const selected = new Set(selectedWords);

  const earned = new Map<string, number>();
  for (const t of tribes) earned.set(t.slug, 0);
  for (const entry of words) {
    if (!selected.has(entry.word)) continue;
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const numberBySlug = new Map(tribes.map((t) => [t.slug, t.number]));

  return tribes
    .map((t) => {
      const avail = available.get(t.slug) ?? 0;
      const got = earned.get(t.slug) ?? 0;
      return { slug: t.slug, score: avail === 0 ? 0 : got / avail };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (numberBySlug.get(a.slug) ?? 0) - (numberBySlug.get(b.slug) ?? 0);
    });
}

/**
 * Derives the headline result from scored tribes. Primary is always the
 * highest. A Secondary is returned only when it scores near the Primary AND is
 * clearly ahead of the third tribe — otherwise the result is honestly just a
 * Primary. Expects `scores` sorted descending (as `score` returns).
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = sorted;

  if (!primary) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const result: AssessmentResult = { primary };

  if (!secondary || secondary.score <= 0 || primary.score <= 0) {
    return result;
  }

  const nearPrimary = secondary.score >= primary.score * (1 - SECONDARY_NEAR_PRIMARY);
  const thirdScore = third ? third.score : 0;
  const aheadOfThird = thirdScore < secondary.score * (1 - SECONDARY_AHEAD_OF_THIRD);

  if (nearPrimary && aheadOfThird) {
    result.secondary = secondary;
  }

  return result;
}
