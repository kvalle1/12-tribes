import { tribes } from "@/lib/tribes";
import { words, wordWeight, type AssessmentWord } from "@/lib/assessment/words";

/**
 * Pure scoring core for the assessment (ADR-0001: normalized tribe scoring).
 *
 * `score(selectedWords)` turns a set of selected adjectives into a normalized
 * 0–1 score for every tribe, and `deriveResult(scores)` reduces those scores to
 * a Primary tribe plus an optional Secondary. Both are pure and reused
 * unchanged by the Self flow and the 360 observer aggregation.
 */

export interface TribeScore {
  /** Tribe slug (matches `tribes[].slug`). */
  slug: string;
  /** Normalized score in [0, 1]: points earned ÷ points available for this tribe. */
  score: number;
}

export interface AssessmentResult {
  /** Slug of the highest-scoring tribe. Always present. */
  primary: string;
  /** Slug of a qualifying second tribe, when one genuinely applies. */
  secondary?: string;
}

/**
 * Secondary is shown only when it scores within (1 - this) of the Primary.
 * 0.8 ⇒ the Secondary must be at least 80% of the Primary's score.
 * Tunable; ships with a reasonable default (PRD: calibration is out of scope).
 */
export const SECONDARY_NEAR_PRIMARY = 0.8;

/**
 * Secondary is shown only when it is clearly ahead of the third tribe: the
 * third must be at most this fraction of the Secondary's score. 0.8 ⇒ the
 * Secondary must lead the third by at least 25%. Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD = 0.8;

/**
 * Total points available for each tribe across the whole word list — the
 * normalization denominator (ADR-0001). Computed once from the word data.
 */
function availablePointsByTribe(wordList: AssessmentWord[]): Map<string, number> {
  const available = new Map<string, number>();
  for (const tribe of tribes) {
    available.set(tribe.slug, 0);
  }
  for (const entry of wordList) {
    const weight = wordWeight(entry);
    for (const slug of entry.tribeSlugs) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

const AVAILABLE_POINTS = availablePointsByTribe(words);

/**
 * Score the selected words. Returns a normalized score for all 12 tribes,
 * sorted by score descending (ties broken by tribe number for stable output).
 * Unknown words (not in the list) are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const byWord = new Map(words.map((w) => [w.word, w] as const));

  const earned = new Map<string, number>();
  for (const tribe of tribes) {
    earned.set(tribe.slug, 0);
  }

  for (const selected of new Set(selectedWords)) {
    const entry = byWord.get(selected);
    if (!entry) continue;
    const weight = wordWeight(entry);
    for (const slug of entry.tribeSlugs) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const orderBySlug = new Map(tribes.map((t) => [t.slug, t.number] as const));

  return tribes
    .map((tribe) => {
      const available = AVAILABLE_POINTS.get(tribe.slug) ?? 0;
      const points = earned.get(tribe.slug) ?? 0;
      return {
        slug: tribe.slug,
        score: available > 0 ? points / available : 0,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (orderBySlug.get(a.slug) ?? 0) - (orderBySlug.get(b.slug) ?? 0),
    );
}

/**
 * Reduce tribe scores to a Primary and an optional Secondary. Accepts scores
 * in any order. Primary is always the highest score. Secondary is returned
 * only when it scores near the Primary AND is clearly ahead of the third tribe;
 * otherwise only a Primary is named (PRD: honest rather than forced).
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  if (primary.score <= 0) {
    return { primary: primary.slug };
  }

  if (!secondary || secondary.score <= 0) {
    return { primary: primary.slug };
  }

  const nearPrimary = secondary.score >= primary.score * SECONDARY_NEAR_PRIMARY;
  const aheadOfThird = !third || third.score <= secondary.score * SECONDARY_AHEAD_OF_THIRD;

  if (nearPrimary && aheadOfThird) {
    return { primary: primary.slug, secondary: secondary.slug };
  }

  return { primary: primary.slug };
}
