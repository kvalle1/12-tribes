import { tribes } from "@/lib/tribes";
import { words, SHARED_WEIGHT, type WordMapping } from "./words";

/** A single tribe's normalized score (0–1) for a set of selected words. */
export interface TribeScore {
  slug: string;
  /** Points earned for this tribe ÷ points available for it (0–1). */
  score: number;
}

/** The derived headline result: always a Primary, optionally a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * Tunable thresholds for whether a Secondary tribe is named (ADR-0001 / PRD).
 * A Secondary is shown only when it scores *near* the Primary AND is *clearly
 * ahead* of the third tribe — otherwise the result names a Primary only.
 */
export const SECONDARY_PRIMARY_RATIO = 0.8; // Secondary ≥ 80% of Primary ("within 20%")
export const SECONDARY_THIRD_RATIO = 0.8; // Third ≤ 80% of Secondary ("clearly ahead")

/** Weight a word contributes to each of its tribes (shared words split 0.5). */
function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? SHARED_WEIGHT : 1;
}

/** Total points available for each tribe across the whole word list. */
const totalAvailable: ReadonlyMap<string, number> = (() => {
  const totals = new Map<string, number>(tribes.map((t) => [t.slug, 0]));
  for (const mapping of words) {
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
})();

/** Fast lookup from a canonical adjective to its mapping. */
const wordIndex: ReadonlyMap<string, WordMapping> = new Map(
  words.map((mapping) => [mapping.word, mapping]),
);

/**
 * Score selected words into a normalized 0–1 value for every tribe.
 *
 * Each tribe's score is `points earned ÷ points available for that tribe`, so
 * high-coverage and low-coverage tribes compete fairly (ADR-0001). A shared
 * word contributes 0.5 to each of its tribes; a sole-mapped word contributes 1.
 * Unknown or duplicate selected words are ignored.
 *
 * Returned in canonical tribe order (by `tribes` array order).
 */
export function score(selectedWords: readonly string[]): TribeScore[] {
  const earned = new Map<string, number>(tribes.map((t) => [t.slug, 0]));

  for (const word of new Set(selectedWords)) {
    const mapping = wordIndex.get(word);
    if (!mapping) continue;
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const available = totalAvailable.get(tribe.slug) ?? 0;
    const got = earned.get(tribe.slug) ?? 0;
    return { slug: tribe.slug, score: available > 0 ? got / available : 0 };
  });
}

/**
 * Derive the headline result from per-tribe scores.
 *
 * Primary is always the highest-scoring tribe. A Secondary is named only when
 * it is within {@link SECONDARY_PRIMARY_RATIO} of the Primary *and* the third
 * tribe is at or below {@link SECONDARY_THIRD_RATIO} of the Secondary — i.e.
 * the Secondary is genuinely close to the Primary and genuinely ahead of the
 * pack. Otherwise only a Primary is returned.
 *
 * Ties are broken by canonical tribe order (the input order from `score`).
 */
export function deriveResult(scores: readonly TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, second, third] = ranked;

  const secondaryQualifies =
    second !== undefined &&
    primary.score > 0 &&
    second.score >= primary.score * SECONDARY_PRIMARY_RATIO &&
    (third === undefined || third.score <= second.score * SECONDARY_THIRD_RATIO);

  return secondaryQualifies ? { primary, secondary: second } : { primary };
}
