import { tribes } from "@/lib/tribes";
import { weightFor, wordTribeMap } from "./words";

/** A single tribe's normalized assessment score (0–1). */
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
 * A Secondary is only shown when it scores at least this fraction of the Primary
 * (≈ "within 20% of Primary"). Tunable.
 */
export const SECONDARY_MIN_RATIO_OF_PRIMARY = 0.8;

/**
 * A Secondary is only shown when the third-ranked tribe scores at most this
 * fraction of the Secondary — i.e. the Secondary is clearly ahead of the third,
 * not in a three-way tie. Tunable.
 */
export const THIRD_MAX_RATIO_OF_SECONDARY = 0.8;

/**
 * The total points available for each tribe across the *whole* word list — the
 * normalization denominator (ADR-0001). A solo word adds 1 to its tribe; a shared
 * word adds 0.5 to each. Computing this from the full list (not the selection) is
 * what makes a 6-word tribe and a 10-word tribe compete fairly.
 */
function availablePointsByTribe(): Map<string, number> {
  const totals = new Map<string, number>(tribes.map((t) => [t.slug, 0]));
  for (const slugs of Object.values(wordTribeMap)) {
    const w = weightFor(slugs);
    for (const slug of slugs) {
      totals.set(slug, (totals.get(slug) ?? 0) + w);
    }
  }
  return totals;
}

/** Tribe number, for a deterministic tie-break when scores are equal. */
const tribeNumber = new Map<string, number>(tribes.map((t) => [t.slug, t.number]));

function byScoreDescThenNumber(a: TribeScore, b: TribeScore): number {
  if (b.score !== a.score) return b.score - a.score;
  return (tribeNumber.get(a.slug) ?? 0) - (tribeNumber.get(b.slug) ?? 0);
}

/**
 * Pure scoring core. Given the words a Subject selected, returns a normalized
 * 0–1 score for *every* tribe, ranked highest-first (deterministic tie-break by
 * tribe number). A score is the points earned for a tribe divided by the points
 * available for it across the whole word list. Unknown words are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const available = availablePointsByTribe();
  const earned = new Map<string, number>(tribes.map((t) => [t.slug, 0]));

  for (const word of selectedWords) {
    const slugs = wordTribeMap[word];
    if (!slugs) continue;
    const w = weightFor(slugs);
    for (const slug of slugs) {
      earned.set(slug, (earned.get(slug) ?? 0) + w);
    }
  }

  return tribes
    .map((t) => {
      const avail = available.get(t.slug) ?? 0;
      const got = earned.get(t.slug) ?? 0;
      return { slug: t.slug, score: avail === 0 ? 0 : got / avail };
    })
    .sort(byScoreDescThenNumber);
}

/**
 * Derives the headline result from a set of tribe scores. Always returns a
 * Primary (the highest). Returns a Secondary only when it is near the Primary
 * (≥ `SECONDARY_MIN_RATIO_OF_PRIMARY`) *and* clearly ahead of the third tribe
 * (third ≤ `THIRD_MAX_RATIO_OF_SECONDARY` of the Secondary). Otherwise only a
 * Primary is named.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort(byScoreDescThenNumber);
  const [primary, secondary, third] = ranked;

  const secondaryQualifies =
    primary !== undefined &&
    primary.score > 0 &&
    secondary !== undefined &&
    secondary.score >= primary.score * SECONDARY_MIN_RATIO_OF_PRIMARY &&
    (third === undefined || third.score <= secondary.score * THIRD_MAX_RATIO_OF_SECONDARY);

  return secondaryQualifies ? { primary, secondary } : { primary };
}
