import { tribes } from "../tribes";
import { words, weightFor } from "./words";

/**
 * A normalized score for a single tribe. `score` is `raw / available` — the
 * points earned for the tribe divided by the points available for it across the
 * whole word list (ADR-0001), giving a 0–1 value comparable across tribes
 * regardless of how many words map to each.
 */
export interface TribeScore {
  slug: string;
  /** Points earned for this tribe from the selected words. */
  raw: number;
  /** Total points available for this tribe across the whole word list. */
  available: number;
  /** Normalized 0–1 score: `raw / available` (0 when nothing is available). */
  score: number;
}

export interface DerivedResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary is shown only when it scores within this fraction of the Primary
 * (i.e. >= Primary * (1 - SECONDARY_PROXIMITY)). Tunable.
 */
export const SECONDARY_PROXIMITY = 0.2;

/**
 * ...and only when it is clearly ahead of the third tribe (the third must sit at
 * least this fraction below the Secondary). Tunable.
 */
export const SECONDARY_LEAD = 0.2;

/** Total points available per tribe across the whole word list (denominator). */
const availableByTribe: ReadonlyMap<string, number> = (() => {
  const totals = new Map<string, number>();
  for (const tribe of tribes) totals.set(tribe.slug, 0);
  for (const mapping of words) {
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
})();

/** Tribe display order (by `number`) for deterministic tie-breaking. */
const orderBySlug: ReadonlyMap<string, number> = new Map(
  tribes.map((tribe) => [tribe.slug, tribe.number]),
);

/** Word -> mapping lookup; unknown selected words are ignored. */
const wordIndex = new Map(words.map((mapping) => [mapping.word, mapping]));

/**
 * Score a set of selected words, returning a normalized {@link TribeScore} for
 * every one of the 12 tribes (in `tribes` order). Pure: depends only on its
 * input and the static word data. Shared words contribute 0.5 to each of their
 * tribes; unknown words are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  for (const selected of selectedWords) {
    const mapping = wordIndex.get(selected);
    if (!mapping) continue;
    const weight = weightFor(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const raw = earned.get(tribe.slug) ?? 0;
    const available = availableByTribe.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      raw,
      available,
      score: available > 0 ? raw / available : 0,
    };
  });
}

/** Rank scores high-to-low, tie-broken by tribe display order. */
function rank(scores: TribeScore[]): TribeScore[] {
  return [...scores].sort(
    (a, b) =>
      b.score - a.score ||
      (orderBySlug.get(a.slug) ?? 0) - (orderBySlug.get(b.slug) ?? 0),
  );
}

/**
 * Derive the headline result from per-tribe scores. Always returns a Primary
 * (the highest score). Returns a Secondary only when it scores near the Primary
 * (within {@link SECONDARY_PROXIMITY}) AND clearly ahead of the third tribe
 * (by at least {@link SECONDARY_LEAD}); otherwise only a Primary is named.
 */
export function deriveResult(scores: TribeScore[]): DerivedResult {
  const ranked = rank(scores);
  const [primary, secondary, third] = ranked;

  if (!secondary || secondary.score <= 0) {
    return { primary };
  }

  const nearPrimary =
    secondary.score >= primary.score * (1 - SECONDARY_PROXIMITY);
  const aheadOfThird =
    !third || secondary.score * (1 - SECONDARY_LEAD) >= third.score;

  return nearPrimary && aheadOfThird ? { primary, secondary } : { primary };
}
