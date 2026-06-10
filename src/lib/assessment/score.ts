import { tribes } from "@/lib/tribes";
import { words, type AssessmentWord } from "./words";

/**
 * A normalized score for one tribe: points earned for that tribe divided by
 * the total points available for it across the whole word list, yielding a
 * 0–1 value that is comparable across tribes regardless of how many words map
 * to each (ADR-0001).
 */
export interface TribeScore {
  slug: string;
  score: number;
}

/**
 * The derived headline result: a Primary tribe always, and a Secondary only
 * when one genuinely qualifies.
 */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * Result-derivation thresholds (tunable, ADR-0001). A Secondary is shown only
 * when it scores within `SECONDARY_WITHIN` of the Primary *and* is clearly
 * ahead of the third tribe by at least `SECONDARY_LEAD`.
 */
export const SECONDARY_WITHIN = 0.2;
export const SECONDARY_LEAD = 0.2;

/** Points a word contributes to each of its mapped tribes. */
function wordWeight(entry: AssessmentWord): number {
  return entry.tribes.length === 1 ? 1 : 0.5;
}

/** Total points available for each tribe across the entire word list. */
function computeAvailableByTribe(): Map<string, number> {
  const available = new Map<string, number>();
  for (const tribe of tribes) {
    available.set(tribe.slug, 0);
  }
  for (const entry of words) {
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

const availableByTribe = computeAvailableByTribe();

/** Lookup from word text to its mapping. */
const wordsByText = new Map(words.map((entry) => [entry.word, entry]));

/**
 * Score a set of selected words into a normalized 0–1 value for every tribe.
 *
 * Each selected word contributes its weight (1 for a single-tribe word, 0.5
 * for a shared word) to each mapped tribe; the per-tribe total is divided by
 * that tribe's available points. Duplicate selections are counted once;
 * unknown words are ignored. Returns one entry per tribe, in canonical order.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned = new Map<string, number>();
  for (const tribe of tribes) {
    earned.set(tribe.slug, 0);
  }

  for (const word of new Set(selectedWords)) {
    const entry = wordsByText.get(word);
    if (!entry) continue;
    const weight = wordWeight(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const available = availableByTribe.get(tribe.slug) ?? 0;
    const points = earned.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      score: available === 0 ? 0 : points / available,
    };
  });
}

/**
 * Derive the Primary (and optional Secondary) tribe from a set of scores.
 *
 * Primary is always the highest score. A Secondary is returned only when it
 * is near the Primary (within `SECONDARY_WITHIN`) and clearly ahead of the
 * third tribe (by at least `SECONDARY_LEAD`) — otherwise the result names a
 * Primary alone. Ties break by canonical tribe order for determinism.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("Cannot derive a result from an empty score list");
  }

  const order = new Map(tribes.map((tribe, index) => [tribe.slug, index]));
  const ranked = [...scores].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0);
  });

  const [primary, secondary, third] = ranked;
  if (!secondary || primary.score === 0 || secondary.score === 0) {
    return { primary };
  }

  const nearPrimary = secondary.score >= primary.score * (1 - SECONDARY_WITHIN);
  const aheadOfThird =
    !third || third.score <= secondary.score * (1 - SECONDARY_LEAD);

  return nearPrimary && aheadOfThird ? { primary, secondary } : { primary };
}
