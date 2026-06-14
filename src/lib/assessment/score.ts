import { tribes } from "@/lib/tribes";
import { perTribeWeight, words } from "@/lib/assessment/words";

/**
 * Pure scoring core for the Tribe Index assessment.
 *
 * Scoring is *normalized* (ADR-0001): a tribe's score is the points earned for
 * it divided by the total points available for it across the whole word list —
 * a 0–1 value that is comparable across tribes regardless of how many words map
 * to each. A shared word contributes 0.5 to each of its tribes (see
 * `perTribeWeight`), feeding both the numerator (when selected) and the
 * per-tribe denominator.
 *
 * Everything here is pure: same inputs, same outputs, no I/O. The 360 observer
 * aggregation (a later slice) reuses `score` unchanged.
 */

export interface TribeScore {
  /** The tribe's slug. */
  slug: string;
  /** Normalized score in the range 0–1. */
  score: number;
}

export interface DerivedResult {
  /** The slug of the highest-scoring tribe — always present. */
  primary: string;
  /** The slug of a qualifying near-tie tribe, when one applies. */
  secondary?: string;
}

/**
 * A Secondary tribe is shown only when it scores at least this fraction of the
 * Primary's score (i.e. within ~20% of Primary). Tunable.
 */
export const SECONDARY_NEAR_PRIMARY = 0.8;
/**
 * A Secondary tribe is shown only when the third-place tribe scores at most
 * this fraction of the Secondary's score (i.e. Secondary is clearly ahead of
 * the third tribe). Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD = 0.8;

/** Total points available for each tribe across the whole word list. */
const availablePointsBySlug = (() => {
  const totals = new Map<string, number>();
  for (const mapping of words) {
    const weight = perTribeWeight(mapping);
    for (const slug of mapping.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
})();

/** Tribe array index by slug, used as a stable tie-break when ranking. */
const tribeOrderBySlug = new Map(tribes.map((t, i) => [t.slug, i]));

/**
 * Score a set of selected words, returning a normalized 0–1 score for every
 * tribe (in `tribes` order). Unknown words are ignored; duplicate selections
 * are counted once.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords);
  const earned = new Map<string, number>();

  for (const mapping of words) {
    if (!selected.has(mapping.word)) continue;
    const weight = perTribeWeight(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const available = availablePointsBySlug.get(tribe.slug) ?? 0;
    const got = earned.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      score: available > 0 ? got / available : 0,
    };
  });
}

/**
 * Derive the result from a set of tribe scores. Always returns a Primary (the
 * highest score). Returns a Secondary only when it is near the Primary
 * (`SECONDARY_NEAR_PRIMARY`) *and* clearly ahead of the third tribe
 * (`SECONDARY_AHEAD_OF_THIRD`); otherwise only a Primary is named.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ai = tribeOrderBySlug.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
    const bi = tribeOrderBySlug.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  const [primary, second, third] = ranked;
  const result: DerivedResult = { primary: primary.slug };

  const secondaryQualifies =
    second !== undefined &&
    primary.score > 0 &&
    second.score >= SECONDARY_NEAR_PRIMARY * primary.score &&
    (third === undefined ||
      third.score <= SECONDARY_AHEAD_OF_THIRD * second.score);

  if (secondaryQualifies) {
    result.secondary = second.slug;
  }

  return result;
}
