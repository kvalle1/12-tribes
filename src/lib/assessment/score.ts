import { tribes } from "@/lib/tribes";
import { words, wordWeight, type AssessmentWord } from "./words";

/**
 * A single tribe's normalized score: the points earned for that tribe divided
 * by the total points available for it across the whole word list (ADR-0001),
 * yielding a 0–1 value comparable across tribes regardless of how many words
 * map to each.
 */
export interface TribeScore {
  /** Tribe slug, matching `tribes.ts`. */
  readonly slug: string;
  /** Normalized score in [0, 1]. */
  readonly score: number;
}

/** The Primary tribe and an optional Secondary, derived from a set of scores. */
export interface DerivedResult {
  /** The highest-scoring tribe; always present. */
  readonly primary: string;
  /** A near-Primary tribe, present only when it genuinely qualifies. */
  readonly secondary?: string;
}

/**
 * A Secondary is only offered when it scores within this fraction of the
 * Primary — i.e. no more than 20% below it.
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
/**
 * A Secondary must also stand clearly ahead of the third-place tribe: the third
 * tribe must sit at or below this fraction of the Secondary's score (≥20%
 * behind). Otherwise the second and third are effectively tied and naming a
 * single Secondary would be arbitrary.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/**
 * The total points available for each tribe across the entire word list — the
 * denominator of the normalized score. Computed once from the word data.
 */
export function availablePointsByTribe(): Record<string, number> {
  const available: Record<string, number> = {};
  for (const tribe of tribes) {
    available[tribe.slug] = 0;
  }
  for (const entry of words) {
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      available[slug] = (available[slug] ?? 0) + weight;
    }
  }
  return available;
}

const wordsByLabel: Map<string, AssessmentWord> = new Map(
  words.map((entry) => [entry.word, entry]),
);

/**
 * Scores a set of selected words, returning a normalized score for every tribe,
 * ranked from highest to lowest (ties broken by tribe number for stable
 * output). Unknown or duplicate selections are ignored so callers can pass raw
 * input safely.
 */
export function score(selectedWords: readonly string[]): TribeScore[] {
  const available = availablePointsByTribe();
  const earned: Record<string, number> = {};
  for (const tribe of tribes) {
    earned[tribe.slug] = 0;
  }

  const counted = new Set<string>();
  for (const label of selectedWords) {
    if (counted.has(label)) continue;
    const entry = wordsByLabel.get(label);
    if (!entry) continue;
    counted.add(label);
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      earned[slug] += weight;
    }
  }

  const orderBySlug = new Map(tribes.map((t, i) => [t.slug, i]));
  return tribes
    .map((tribe) => {
      const denom = available[tribe.slug];
      return {
        slug: tribe.slug,
        score: denom > 0 ? earned[tribe.slug] / denom : 0,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (orderBySlug.get(a.slug)! - orderBySlug.get(b.slug)!),
    );
}

/**
 * Derives the headline result from a set of tribe scores. The Primary is always
 * the highest score. A Secondary is named only when it is near the Primary
 * (within {@link SECONDARY_NEAR_PRIMARY_RATIO}) *and* clearly ahead of the
 * third-place tribe (by {@link SECONDARY_AHEAD_OF_THIRD_RATIO}); otherwise only
 * a Primary is returned.
 */
export function deriveResult(scores: readonly TribeScore[]): DerivedResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score.");
  }

  const ranked = [...scores].sort(
    (a, b) => b.score - a.score || a.slug.localeCompare(b.slug),
  );

  const primary = ranked[0];
  const secondary = ranked[1];
  const third = ranked[2];

  // With no points earned anywhere, there is no meaningful Secondary.
  if (primary.score <= 0 || !secondary || secondary.score <= 0) {
    return { primary: primary.slug };
  }

  const nearPrimary =
    secondary.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO;
  const aheadOfThird =
    !third || third.score <= secondary.score * SECONDARY_AHEAD_OF_THIRD_RATIO;

  if (nearPrimary && aheadOfThird) {
    return { primary: primary.slug, secondary: secondary.slug };
  }
  return { primary: primary.slug };
}
