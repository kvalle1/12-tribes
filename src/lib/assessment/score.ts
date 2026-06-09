import { tribes } from "@/lib/tribes";
import { words as defaultWords, wordWeight, type WordMapping } from "./words";

/**
 * Pure scoring core for the assessment (ADR-0001). Given the words a Subject (or
 * Observer) selected, `score` produces a normalized 0–1 value per tribe, and
 * `deriveResult` names a Primary tribe plus an optional Secondary.
 *
 * Normalization is by each tribe's *available* points — the total it could earn
 * if every word mapped to it were picked — so a tribe with few words and a tribe
 * with many words compete fairly.
 */

export interface TribeScore {
  /** Tribe slug, referencing `tribes`. */
  slug: string;
  /** Normalized score in [0, 1]: points earned ÷ points available for the tribe. */
  score: number;
}

export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/** A Secondary must score within this fraction of the Primary to qualify. */
export const SECONDARY_MAX_GAP_FROM_PRIMARY = 0.2;
/** A Secondary must lead the third-place tribe by at least this fraction. */
export const SECONDARY_MIN_LEAD_OVER_THIRD = 0.2;

/** Sum of `wordWeight` across every word that maps to each tribe. */
function availablePointsByTribe(wordList: WordMapping[]): Map<string, number> {
  const available = new Map<string, number>();
  for (const tribe of tribes) available.set(tribe.slug, 0);
  for (const mapping of wordList) {
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

/**
 * Normalized tribe scores for the given selection, one entry per tribe, sorted
 * by score descending (ties broken by tribe number to stay deterministic).
 * Unknown words are ignored. Pure — does not enforce the 8–15 selection range.
 */
export function score(
  selectedWords: string[],
  wordList: WordMapping[] = defaultWords,
): TribeScore[] {
  const byWord = new Map(wordList.map((m) => [m.word, m]));
  const available = availablePointsByTribe(wordList);

  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  const seen = new Set<string>();
  for (const word of selectedWords) {
    if (seen.has(word)) continue; // a word counts at most once
    seen.add(word);
    const mapping = byWord.get(word);
    if (!mapping) continue; // ignore words outside the list
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes
    .map((tribe) => {
      const denom = available.get(tribe.slug) ?? 0;
      const num = earned.get(tribe.slug) ?? 0;
      return { slug: tribe.slug, score: denom > 0 ? num / denom : 0 };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return tribeNumber(a.slug) - tribeNumber(b.slug);
    });
}

function tribeNumber(slug: string): number {
  return tribes.find((t) => t.slug === slug)?.number ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Names the Primary (always the highest-scoring tribe) and an optional Secondary.
 * The Secondary is returned only when it scores near the Primary (within
 * `SECONDARY_MAX_GAP_FROM_PRIMARY`) *and* is clearly ahead of the third tribe
 * (by at least `SECONDARY_MIN_LEAD_OVER_THIRD`), so the result stays honest
 * rather than forcing a second tribe.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  if (!secondary || secondary.score <= 0) {
    return { primary };
  }

  const nearPrimary =
    secondary.score >= primary.score * (1 - SECONDARY_MAX_GAP_FROM_PRIMARY);
  const aheadOfThird =
    !third || third.score <= secondary.score * (1 - SECONDARY_MIN_LEAD_OVER_THIRD);

  return nearPrimary && aheadOfThird ? { primary, secondary } : { primary };
}
