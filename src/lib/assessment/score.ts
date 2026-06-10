import { tribes } from "../tribes";
import { wordMappings, type WordMapping } from "./words";

/** A tribe's normalized score (0–1) for a given set of selected words. */
export interface TribeScore {
  slug: string;
  score: number;
}

/** The derived headline result: always a Primary, optionally a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * Secondary is shown only when it scores *near* the Primary — within this
 * fraction below Primary (≈ within 20%) — AND clearly ahead of the third tribe.
 * Tunable (ADR-0001).
 */
export const SECONDARY_PROXIMITY = 0.2;

/**
 * ...and only when it leads the third tribe by more than this fraction, so a
 * Secondary that is essentially tied with the third tribe is not shown. Tunable.
 */
export const SECONDARY_SEPARATION = 0.2;

/**
 * Points a word contributes to *each* tribe it maps to: a sole-tribe word is
 * worth 1, a shared word (two or more tribes) contributes 0.5 to each
 * (ASSESSMENT_DESIGN.md / ADR-0001).
 */
function wordWeight(mapping: WordMapping): number {
  return mapping.tribeSlugs.length > 1 ? 0.5 : 1;
}

/**
 * Score the selected words. Each tribe's score is normalized: the points earned
 * for that tribe divided by the total points available for it across the whole
 * word list — a 0–1 value comparable across tribes regardless of how many words
 * cover each one. Returns one entry per tribe, in `tribes` order. Unknown words
 * are ignored; matching is case-insensitive.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const available = new Map<string, number>();
  const earned = new Map<string, number>();
  for (const tribe of tribes) {
    available.set(tribe.slug, 0);
    earned.set(tribe.slug, 0);
  }

  const byWord = new Map(wordMappings.map((m) => [m.word.toLowerCase(), m]));

  for (const mapping of wordMappings) {
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribeSlugs) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }

  const selected = new Set(selectedWords.map((w) => w.toLowerCase()));
  for (const word of selected) {
    const mapping = byWord.get(word);
    if (!mapping) continue;
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribeSlugs) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const avail = available.get(tribe.slug) ?? 0;
    const earn = earned.get(tribe.slug) ?? 0;
    return { slug: tribe.slug, score: avail > 0 ? earn / avail : 0 };
  });
}

/**
 * Derive the headline result from a set of tribe scores. The Primary is always
 * the highest score. A Secondary is returned only when it scores near the
 * Primary (within SECONDARY_PROXIMITY) *and* leads the third tribe by more than
 * SECONDARY_SEPARATION — otherwise only a Primary is named (an honest result
 * rather than a forced blend). Ties are broken by `tribes` order (stable).
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, second, third] = ranked;

  if (!second || primary.score === 0) {
    return { primary };
  }

  const nearPrimary = second.score >= primary.score * (1 - SECONDARY_PROXIMITY);
  const aheadOfThird =
    !third || third.score <= second.score * (1 - SECONDARY_SEPARATION);

  if (nearPrimary && aheadOfThird) {
    return { primary, secondary: second };
  }
  return { primary };
}
