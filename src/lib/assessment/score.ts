import { tribes } from "@/lib/tribes";
import { words as defaultWords, type WordMapping } from "./words";

/**
 * Pure scoring core for the assessment (ADR-0001).
 *
 * Scoring is *normalized*: a tribe's score is the points it earned from the
 * selected words divided by the total points available for it across the whole
 * word list — a 0–1 value comparable across tribes regardless of how many words
 * cover each. A Shared word (mapped to N > 1 tribes) contributes 0.5 to each;
 * an exclusive word contributes 1.
 *
 * The module exposes a tiny interface — `score()` and `deriveResult()` — and is
 * reused unchanged by the self-assessment, profile, and 360 aggregation.
 */

export interface TribeScore {
  /** Tribe slug, keyed to the `tribes` source of truth. */
  slug: string;
  /** Normalized score in [0, 1]. */
  score: number;
}

export interface AssessmentResult {
  primary: TribeScore;
  /** Present only when a genuine Secondary qualifies (see thresholds below). */
  secondary?: TribeScore;
}

/**
 * A Secondary is shown only when it scores *near* the Primary: at least
 * (1 - SECONDARY_NEAR_PRIMARY) of the Primary's score.
 */
export const SECONDARY_NEAR_PRIMARY = 0.2;

/**
 * ...and is *clearly ahead* of the third tribe: at least
 * (1 + SECONDARY_AHEAD_OF_THIRD) times the third tribe's score. When the
 * Secondary is ~tied with the third, it is suppressed.
 */
export const SECONDARY_AHEAD_OF_THIRD = 0.2;

/** Per-tribe weight a word contributes: Shared words split 0.5 each. */
function weightFor(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? 0.5 : 1;
}

/**
 * Score the selected words, returning a normalized score for every tribe,
 * ranked highest-first (ties broken by tribe `number` for determinism).
 */
export function score(
  selectedWords: string[],
  wordData: WordMapping[] = defaultWords,
): TribeScore[] {
  const byWord = new Map(wordData.map((m) => [m.word, m]));

  // Total points available per tribe across the whole word list (denominator).
  const available = new Map<string, number>();
  for (const mapping of wordData) {
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }

  // Points earned per tribe from the (de-duplicated) selection (numerator).
  const earned = new Map<string, number>();
  for (const word of new Set(selectedWords)) {
    const mapping = byWord.get(word);
    if (!mapping) continue;
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const order = new Map(tribes.map((t) => [t.slug, t.number]));

  return tribes
    .map((t) => {
      const denom = available.get(t.slug) ?? 0;
      const numer = earned.get(t.slug) ?? 0;
      return { slug: t.slug, score: denom === 0 ? 0 : numer / denom };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0),
    );
}

/**
 * Derive the headline result from ranked scores: always a Primary, and a
 * Secondary only when it is both near the Primary and clearly ahead of third.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondaryCandidate, third] = ranked;

  if (!primary) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const qualifies =
    secondaryCandidate !== undefined &&
    secondaryCandidate.score > 0 &&
    secondaryCandidate.score >= primary.score * (1 - SECONDARY_NEAR_PRIMARY) &&
    secondaryCandidate.score >= (third?.score ?? 0) * (1 + SECONDARY_AHEAD_OF_THIRD);

  return qualifies
    ? { primary, secondary: secondaryCandidate }
    : { primary };
}
