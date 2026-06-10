import { tribes } from "@/lib/tribes";
import { words, wordWeight } from "./words";

/** A tribe's normalized result: 0–1, comparable across tribes (ADR-0001). */
export interface TribeScore {
  /** Tribe slug, referencing `tribes`. */
  slug: string;
  /**
   * Normalized score: points earned for this tribe divided by the total points
   * available for it across the whole word list. 0 when none of its words were
   * selected, 1 when all of them were.
   */
  score: number;
}

export interface DerivedResult {
  /** The highest-scoring tribe. Always present. */
  primary: TribeScore;
  /** A close runner-up, present only when it qualifies (see thresholds). */
  secondary?: TribeScore;
}

/**
 * A Secondary is shown only when it scores within this fraction below the
 * Primary — i.e. `secondary >= primary * (1 - SECONDARY_WITHIN)`. Tunable.
 */
export const SECONDARY_WITHIN = 0.2;

/**
 * ...and only when it is clearly ahead of the third tribe by at least this
 * fraction — i.e. `secondary >= third * (1 + SECONDARY_LEAD_OVER_THIRD)`.
 * Otherwise the runner-up is too contested to name and only a Primary is shown.
 * Tunable.
 */
export const SECONDARY_LEAD_OVER_THIRD = 0.2;

/**
 * Total points available for each tribe across the whole word list: the sum of
 * every mapped word's per-tribe weight. This is the normalization denominator,
 * so a 6-word tribe and a 10-word tribe compete fairly.
 */
function availablePointsByTribe(): Map<string, number> {
  const available = new Map<string, number>();
  for (const t of tribes) available.set(t.slug, 0);
  for (const entry of words) {
    const w = wordWeight(entry);
    for (const slug of entry.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + w);
    }
  }
  return available;
}

/**
 * Scores a set of selected words into a normalized 0–1 value for every tribe.
 *
 * Each selected word contributes its per-tribe weight (a Shared word splits
 * evenly — 0.5 to each of two tribes) to each tribe it maps to; the tribe's
 * earned points are then divided by its available points (ADR-0001). Returns
 * all 12 tribes in canonical (`tribes`) order. Unknown or duplicate words are
 * ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const available = availablePointsByTribe();
  const selected = new Set(selectedWords);
  const earned = new Map<string, number>();
  for (const t of tribes) earned.set(t.slug, 0);

  for (const entry of words) {
    if (!selected.has(entry.word)) continue;
    const w = wordWeight(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + w);
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
 * Derives the headline result from a set of tribe scores: always a Primary (the
 * highest), and a Secondary only when it genuinely applies — near the Primary
 * (within SECONDARY_WITHIN) and clearly ahead of the third tribe (by
 * SECONDARY_LEAD_OVER_THIRD). Otherwise only a Primary is named.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const primary = ranked[0];
  const second = ranked[1];
  const third = ranked[2];

  const qualifies =
    primary.score > 0 &&
    second !== undefined &&
    second.score > 0 &&
    second.score >= primary.score * (1 - SECONDARY_WITHIN) &&
    (third === undefined ||
      second.score >= third.score * (1 + SECONDARY_LEAD_OVER_THIRD));

  return qualifies ? { primary, secondary: second } : { primary };
}
