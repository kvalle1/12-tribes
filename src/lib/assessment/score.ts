import { tribes } from "@/lib/tribes";
import { wordMappings, type WordMapping } from "./words";

/**
 * Normalized scoring for the Self / 360 word-selection assessment (ADR-0001).
 *
 * A word contributes a weight to each tribe it maps to:
 *  - an exclusive word (one tribe) contributes 1.0,
 *  - a shared word (two or more tribes) contributes 0.5 to *each* of its tribes.
 *
 * A tribe's score is the points it earned from the selected words divided by the
 * total points available to it across the whole word list — a 0–1 value that is
 * comparable across tribes regardless of how many words cover each tribe (so a
 * 6-word tribe and a 10-word tribe compete fairly).
 */

/** Weight a shared (multi-tribe) word contributes to each of its tribes. */
const SHARED_WORD_WEIGHT = 0.5;
/** Weight an exclusive (single-tribe) word contributes to its tribe. */
const EXCLUSIVE_WORD_WEIGHT = 1;

/**
 * Secondary is shown only when it scores at least this fraction of the Primary
 * (i.e. within ~20% of Primary).
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
/**
 * Secondary is shown only when it is at least this many times the third tribe's
 * score (i.e. clearly ahead of the third, not ~tied with it).
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 1.2;

export interface TribeScore {
  /** Tribe slug, matching the `tribes` source of truth. */
  slug: string;
  /** Normalized score in [0, 1]. */
  score: number;
}

export interface AssessmentResult {
  /** Highest-scoring tribe; always present. */
  primary: TribeScore;
  /** Runner-up, present only when it is near Primary and clearly ahead of third. */
  secondary?: TribeScore;
}

/** The weight a word contributes to each of its mapped tribes. */
function weightFor(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? SHARED_WORD_WEIGHT : EXCLUSIVE_WORD_WEIGHT;
}

/** Total points available to each tribe across the entire word list. */
function availablePointsByTribe(): Map<string, number> {
  const available = new Map<string, number>();
  for (const tribe of tribes) available.set(tribe.slug, 0);

  for (const mapping of wordMappings) {
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Scores a selection of words, returning a normalized score for every tribe in
 * canonical (`tribes` array) order. Unrecognized or duplicate selections are
 * ignored — each distinct word counts at most once.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords);
  const available = availablePointsByTribe();
  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  for (const mapping of wordMappings) {
    if (!selected.has(mapping.word)) continue;
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const total = available.get(tribe.slug) ?? 0;
    const points = earned.get(tribe.slug) ?? 0;
    return { slug: tribe.slug, score: total > 0 ? points / total : 0 };
  });
}

/**
 * Derives the headline result from a set of tribe scores. Always names a
 * Primary (the highest score). Names a Secondary only when it is both near the
 * Primary (`SECONDARY_NEAR_PRIMARY_RATIO`) and clearly ahead of the third tribe
 * (`SECONDARY_AHEAD_OF_THIRD_RATIO`); otherwise only a Primary is returned.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  // Stable, deterministic ranking: by score desc, ties broken by input order
  // (score() emits in canonical tribe order, so ties break by tribe number).
  const order = new Map(scores.map((s, i) => [s.slug, i]));
  const ranked = [...scores].sort(
    (a, b) => b.score - a.score || order.get(a.slug)! - order.get(b.slug)!,
  );

  const [primary, second, third] = ranked;
  let secondary: TribeScore | undefined;

  if (primary.score > 0 && second) {
    const nearPrimary = second.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO;
    const thirdScore = third?.score ?? 0;
    const aheadOfThird =
      second.score > thirdScore &&
      second.score >= thirdScore * SECONDARY_AHEAD_OF_THIRD_RATIO;
    if (nearPrimary && aheadOfThird) secondary = second;
  }

  return { primary, secondary };
}
