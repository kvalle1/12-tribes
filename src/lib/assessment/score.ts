import { tribes } from "@/lib/tribes";
import { AssessmentWord, words } from "./words";

/**
 * A single tribe's normalized score for a set of selected words.
 *
 * `score` is in [0, 1]: the points the selection earned for this tribe divided
 * by the total points available for it across the whole word list (ADR-0001).
 * Because it is normalized per-tribe, scores are directly comparable regardless
 * of how many words map to each tribe.
 */
export interface TribeScore {
  slug: string;
  score: number;
}

/** The Primary tribe, plus a Secondary when one genuinely applies. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary is only named when it scores within this fraction *below* the
 * Primary (i.e. is "near" it). Tunable.
 */
export const SECONDARY_PROXIMITY = 0.2;

/**
 * ...and is clearly ahead of the third tribe by at least this fraction.
 * Tunable.
 */
export const SECONDARY_LEAD_OVER_THIRD = 0.2;

/**
 * The per-word weight contributed to each tribe the word maps to: a shared word
 * (mapped to more than one tribe) contributes 0.5 to each; a single-tribe word
 * contributes the full 1.0. This is the numerator weight; the final tribe score
 * normalizes by available points (ADR-0001).
 */
function weightPerTribe(entry: AssessmentWord): number {
  return entry.tribes.length > 1 ? 0.5 : 1;
}

/** Total points available for each tribe across the entire word list. */
function availablePointsByTribe(): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tribe of tribes) totals.set(tribe.slug, 0);
  for (const entry of words) {
    const weight = weightPerTribe(entry);
    for (const slug of entry.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
}

const tribeOrder = new Map(tribes.map((t) => [t.slug, t.number]));

/** Stable ordering: highest score first, ties broken by tribe number. */
function byScoreThenTribe(a: TribeScore, b: TribeScore): number {
  if (b.score !== a.score) return b.score - a.score;
  return (tribeOrder.get(a.slug) ?? 0) - (tribeOrder.get(b.slug) ?? 0);
}

/**
 * Scores a selection of words across all 12 tribes.
 *
 * Returns a normalized score for every tribe, sorted highest-first. Words not in
 * the list and duplicate selections are ignored. Pure — no side effects.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const totals = availablePointsByTribe();
  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  const wordByName = new Map(words.map((w) => [w.word.toLowerCase(), w]));
  const counted = new Set<string>();

  for (const selection of selectedWords) {
    const key = selection.trim().toLowerCase();
    const entry = wordByName.get(key);
    if (!entry || counted.has(key)) continue;
    counted.add(key);
    const weight = weightPerTribe(entry);
    for (const slug of entry.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes
    .map<TribeScore>((tribe) => {
      const available = totals.get(tribe.slug) ?? 0;
      const got = earned.get(tribe.slug) ?? 0;
      return { slug: tribe.slug, score: available > 0 ? got / available : 0 };
    })
    .sort(byScoreThenTribe);
}

/**
 * Derives the headline result from a set of tribe scores.
 *
 * The Primary is always the highest-scoring tribe. A Secondary is named only
 * when it is *near* the Primary (within `SECONDARY_PROXIMITY`) and *clearly
 * ahead* of the third tribe (by `SECONDARY_LEAD_OVER_THIRD`); otherwise only a
 * Primary is returned, so the result is honest rather than forced.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const sorted = [...scores].sort(byScoreThenTribe);
  const [primary, second, third] = sorted;

  let secondary: TribeScore | undefined;
  if (second && second.score > 0) {
    const nearPrimary = second.score >= primary.score * (1 - SECONDARY_PROXIMITY);
    const thirdScore = third?.score ?? 0;
    const aheadOfThird = second.score >= thirdScore * (1 + SECONDARY_LEAD_OVER_THIRD);
    if (nearPrimary && aheadOfThird) secondary = second;
  }

  return secondary ? { primary, secondary } : { primary };
}
