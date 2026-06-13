import { tribes } from "@/lib/tribes";
import { words, wordWeight } from "./words";

/**
 * Pure scoring core for the Self Assessment. Two functions behind a small
 * interface — `score()` turns selected words into a normalized score per tribe,
 * and `deriveResult()` turns those scores into a Primary (and optional Secondary)
 * tribe. No I/O, no framework, no randomness — reused unchanged by the self flow
 * and the 360 layer (ADR-0001).
 */

export interface TribeScore {
  /** The tribe's slug (matches `tribes[].slug`). */
  slug: string;
  /**
   * Normalized 0–1 score: points earned for this tribe divided by the total
   * points available for it across the whole word list. Comparable across tribes
   * regardless of how many words map to each (ADR-0001).
   */
  score: number;
}

export interface AssessmentResult {
  /** The highest-scoring tribe. Always present. */
  primary: TribeScore;
  /** A close runner-up, shown only when it qualifies (see `deriveResult`). */
  secondary?: TribeScore;
}

/**
 * A Secondary must score at least this fraction of the Primary's score to count
 * as "near" it (≈ within 20%). Tunable.
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;

/**
 * A Secondary must be "clearly ahead" of the third tribe: the third may score at
 * most this fraction of the Secondary's score. If the third is closer than that,
 * the Secondary is treated as ~tied with the field and suppressed. Tunable.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** slug → tribe number, for deterministic tie-breaking. */
const tribeNumberBySlug = new Map(tribes.map((t) => [t.slug, t.number]));

/** Total points available for each tribe across the entire word list. */
function availablePointsByTribe(): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of words) {
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
}

/**
 * Score a set of selected words, returning a normalized 0–1 score for every
 * tribe (always all 12, in `tribes` order). Unknown words are ignored and
 * duplicates are counted once, so callers can pass raw selections safely.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const wordBySpelling = new Map(words.map((w) => [w.word, w]));
  const available = availablePointsByTribe();
  const earned = new Map<string, number>();
  const counted = new Set<string>();

  for (const selection of selectedWords) {
    const entry = wordBySpelling.get(selection);
    if (!entry || counted.has(selection)) continue;
    counted.add(selection);

    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((t) => {
    const total = available.get(t.slug) ?? 0;
    return {
      slug: t.slug,
      score: total === 0 ? 0 : (earned.get(t.slug) ?? 0) / total,
    };
  });
}

/**
 * Derive the result from per-tribe scores. The Primary is always the
 * highest-scoring tribe. A Secondary is returned only when it scores near the
 * Primary AND is clearly ahead of the third tribe; otherwise only a Primary is
 * named. Ties break deterministically by tribe number.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort(
    (a, b) =>
      b.score - a.score ||
      (tribeNumberBySlug.get(a.slug) ?? 0) - (tribeNumberBySlug.get(b.slug) ?? 0),
  );

  const [primary, secondary, third] = ranked;

  const secondaryQualifies =
    secondary !== undefined &&
    secondary.score > 0 &&
    secondary.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO &&
    (third === undefined ||
      third.score <= secondary.score * SECONDARY_AHEAD_OF_THIRD_RATIO);

  return secondaryQualifies ? { primary, secondary } : { primary };
}
