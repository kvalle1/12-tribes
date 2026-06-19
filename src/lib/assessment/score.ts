import { tribes } from "@/lib/tribes";
import { wordMappings, type WordMapping } from "@/lib/assessment/words";

/**
 * Per-word weighting (ADR-0001). A word mapped to a single tribe contributes
 * a full point to it; a "shared" word (mapped to two or more tribes)
 * contributes half a point to each.
 */
export const WORD_SOLO_WEIGHT = 1;
export const WORD_SHARED_WEIGHT = 0.5;

/**
 * Result-derivation thresholds (tunable). A Secondary tribe is reported only
 * when it scores *near* the Primary AND is *clearly ahead* of the third tribe:
 *
 * - `SECONDARY_MIN_RATIO_OF_PRIMARY` — the Secondary must score at least this
 *   fraction of the Primary (≈ within 20%).
 * - `THIRD_MAX_RATIO_OF_SECONDARY` — the third tribe must score no more than
 *   this fraction of the Secondary, otherwise the Secondary isn't a clear
 *   runner-up and only a Primary is named.
 */
export const SECONDARY_MIN_RATIO_OF_PRIMARY = 0.8;
export const THIRD_MAX_RATIO_OF_SECONDARY = 0.8;

/** A single tribe's normalized score (0–1) for a selection. */
export interface TribeScore {
  slug: string;
  /** Points earned for this tribe ÷ points available for it. Range 0–1. */
  score: number;
}

/** The headline outcome of a selection: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/** The weight a word contributes to each of its tribes. */
function weightOf(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? WORD_SHARED_WEIGHT : WORD_SOLO_WEIGHT;
}

/**
 * The total points available for each tribe across the *entire* word list —
 * the denominator for normalization. Computed once from `wordMappings`.
 */
const availablePointsBySlug: Record<string, number> = (() => {
  const totals: Record<string, number> = {};
  for (const t of tribes) totals[t.slug] = 0;
  for (const mapping of wordMappings) {
    const weight = weightOf(mapping);
    for (const slug of mapping.tribes) {
      totals[slug] = (totals[slug] ?? 0) + weight;
    }
  }
  return totals;
})();

/** The canonical tribe order (by `number`), used as a deterministic tie-break. */
const tribeOrder: Record<string, number> = Object.fromEntries(
  tribes.map((t) => [t.slug, t.number]),
);

/**
 * Score a selection of words. Returns a normalized 0–1 score for **every**
 * tribe (all 12), ranked highest-first with a deterministic tie-break by the
 * tribe's canonical `number`. Words not in the list are ignored. The score is
 * the points earned for a tribe divided by the points available for it across
 * the whole word list, so tribes with broad and narrow word coverage compete
 * fairly (ADR-0001).
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords);

  const earned: Record<string, number> = {};
  for (const t of tribes) earned[t.slug] = 0;

  for (const mapping of wordMappings) {
    if (!selected.has(mapping.word)) continue;
    const weight = weightOf(mapping);
    for (const slug of mapping.tribes) {
      earned[slug] = (earned[slug] ?? 0) + weight;
    }
  }

  return tribes
    .map((t) => {
      const available = availablePointsBySlug[t.slug] ?? 0;
      return {
        slug: t.slug,
        score: available > 0 ? earned[t.slug] / available : 0,
      };
    })
    .sort((a, b) => b.score - a.score || tribeOrder[a.slug] - tribeOrder[b.slug]);
}

/**
 * Derive the headline result from a set of scores. Always returns a Primary
 * (the highest-scoring tribe). Returns a Secondary only when it scores near
 * the Primary and is clearly ahead of the third tribe (see the threshold
 * constants above). Accepts scores in any order.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score.");
  }

  const ranked = [...scores].sort(
    (a, b) => b.score - a.score || tribeOrder[a.slug] - tribeOrder[b.slug],
  );

  const primary = ranked[0];

  // With no positive score there's nothing to distinguish — Primary only.
  if (primary.score <= 0) {
    return { primary };
  }

  const secondary = ranked[1];
  const third = ranked[2];

  const nearPrimary =
    secondary !== undefined &&
    secondary.score > 0 &&
    secondary.score >= primary.score * SECONDARY_MIN_RATIO_OF_PRIMARY;

  const clearOfThird =
    third === undefined ||
    third.score <= secondary!.score * THIRD_MAX_RATIO_OF_SECONDARY;

  if (nearPrimary && clearOfThird) {
    return { primary, secondary };
  }

  return { primary };
}
