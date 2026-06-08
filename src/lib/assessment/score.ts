import { tribes } from "@/lib/tribes";
import { words, type WordMapping } from "@/lib/assessment/words";

/**
 * A single tribe's normalized score for a set of selected words.
 *
 * `score` is in the range 0–1: the points the selection earned for this tribe
 * divided by the total points available for it across the whole word list
 * (ADR-0001). Normalizing by available points lets a tribe with few mapped
 * words and a tribe with many compete fairly.
 */
export interface TribeScore {
  /** Tribe slug, matching `tribes[].slug`. */
  slug: string;
  /** Normalized 0–1 score. */
  score: number;
}

export interface DerivedResult {
  /** The highest-scoring tribe — always present. */
  primary: string;
  /** The runner-up, only when it is near the Primary and clearly ahead of third. */
  secondary?: string;
}

/**
 * A Secondary tribe is only shown when it is *near* the Primary: its score must
 * be at least (1 − SECONDARY_NEAR_PRIMARY) of the Primary's. Tunable.
 */
export const SECONDARY_NEAR_PRIMARY = 0.2;

/**
 * ...and *clearly ahead* of the third tribe: the third tribe's score must be no
 * more than (1 − SECONDARY_LEAD_OVER_THIRD) of the Secondary's. Tunable.
 */
export const SECONDARY_LEAD_OVER_THIRD = 0.2;

/** A word contributes its full weight to a sole tribe, else 0.5 to each (shared). */
function weightFor(mapping: WordMapping): number {
  return mapping.tribes.length === 1 ? 1 : 0.5;
}

/** Total points available for every tribe across the whole word list. */
function availablePointsByTribe(): Map<string, number> {
  const available = new Map<string, number>();
  for (const t of tribes) available.set(t.slug, 0);

  for (const mapping of words) {
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/** Case-insensitive lookup of a word's mapping; unknown words are ignored. */
function mappingIndex(): Map<string, WordMapping> {
  const index = new Map<string, WordMapping>();
  for (const mapping of words) index.set(mapping.word.toLowerCase(), mapping);
  return index;
}

/**
 * Score a set of selected words, returning a normalized 0–1 score for **every**
 * tribe, sorted by score descending (ties broken by tribe number for stable,
 * deterministic ordering). Words not on the list are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const available = availablePointsByTribe();
  const index = mappingIndex();

  const earned = new Map<string, number>();
  for (const t of tribes) earned.set(t.slug, 0);

  for (const raw of selectedWords) {
    const mapping = index.get(raw.toLowerCase());
    if (!mapping) continue;
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const tribeNumber = new Map(tribes.map((t) => [t.slug, t.number]));

  return tribes
    .map((t) => {
      const avail = available.get(t.slug) ?? 0;
      const normalized = avail === 0 ? 0 : (earned.get(t.slug) ?? 0) / avail;
      return { slug: t.slug, score: normalized };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (tribeNumber.get(a.slug) ?? 0) - (tribeNumber.get(b.slug) ?? 0);
    });
}

/**
 * Derive the headline result from scored tribes. The Primary is always the
 * highest score. A Secondary is returned only when it is near the Primary
 * (within `SECONDARY_NEAR_PRIMARY`) *and* clearly ahead of the third tribe
 * (by at least `SECONDARY_LEAD_OVER_THIRD`); otherwise only a Primary is named.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one scored tribe");
  }

  const [primary, secondary, third] = scores;
  const result: DerivedResult = { primary: primary.slug };

  if (!secondary || secondary.score === 0) return result;

  const nearPrimary = secondary.score >= primary.score * (1 - SECONDARY_NEAR_PRIMARY);
  const thirdScore = third?.score ?? 0;
  const aheadOfThird = thirdScore <= secondary.score * (1 - SECONDARY_LEAD_OVER_THIRD);

  if (nearPrimary && aheadOfThird) result.secondary = secondary.slug;

  return result;
}
