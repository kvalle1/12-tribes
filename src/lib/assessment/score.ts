import { tribes } from "../tribes";
import { isShared, words, type Word } from "./words";

/** A tribe's normalized result. See ADR-0001. */
export interface TribeScore {
  /** Tribe slug (matches `tribes.ts`). */
  slug: string;
  /** Normalized score in [0, 1]: points earned ÷ points available. */
  score: number;
}

/** The result of an assessment: always a primary, sometimes a secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * Secondary is shown only when it scores within this fraction of the primary
 * (≈ within 20%) AND clearly ahead of the third tribe by at least this margin.
 * Tunable constants (PRD).
 */
export const SECONDARY_MAX_GAP_FROM_PRIMARY = 0.2;
export const SECONDARY_MIN_LEAD_OVER_THIRD = 0.2;

/**
 * Per-word weight feeding the numerator. A solo word contributes its full
 * point (1.0); a shared word contributes 0.5 to *each* of its tribes
 * (ADR-0001 / `ASSESSMENT_DESIGN.md`).
 */
function weightOf(word: Word): number {
  return isShared(word) ? 0.5 : 1;
}

/**
 * Total points available for each tribe across the whole word list — the
 * normalization denominator. Computed once from the static word data.
 */
const availablePoints: Map<string, number> = (() => {
  const totals = new Map<string, number>();
  for (const slug of tribes.map((t) => t.slug)) {
    totals.set(slug, 0);
  }
  for (const word of words) {
    const weight = weightOf(word);
    for (const slug of word.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
})();

/**
 * Score the selected words into a normalized result for every tribe.
 *
 * Each tribe's score is the points it earned from the selection divided by the
 * total points available for it across the entire word list (ADR-0001), so a
 * 6-word tribe and a 10-word tribe compete fairly. Returns all 12 tribes
 * ranked by score (descending), with ties broken by tribe number for
 * determinism. Unknown words in the input are ignored.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const selected = new Set(selectedWords);
  const earned = new Map<string, number>();
  for (const slug of tribes.map((t) => t.slug)) {
    earned.set(slug, 0);
  }
  for (const word of words) {
    if (!selected.has(word.word)) continue;
    const weight = weightOf(word);
    for (const slug of word.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const numberBySlug = new Map(tribes.map((t) => [t.slug, t.number]));
  return tribes
    .map((t) => {
      const available = availablePoints.get(t.slug) ?? 0;
      const points = earned.get(t.slug) ?? 0;
      return { slug: t.slug, score: available > 0 ? points / available : 0 };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (numberBySlug.get(a.slug) ?? 0) - (numberBySlug.get(b.slug) ?? 0),
    );
}

/**
 * Derive the headline result from scored tribes. The primary is always the
 * highest scorer. A secondary is named only when it is near the primary
 * (within {@link SECONDARY_MAX_GAP_FROM_PRIMARY}) and clearly ahead of the
 * third tribe (by {@link SECONDARY_MIN_LEAD_OVER_THIRD}); otherwise the result
 * names only a primary, so it stays honest rather than forced.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const [primary, secondary, third] = ranked;

  const qualifies =
    secondary !== undefined &&
    primary.score > 0 &&
    secondary.score >= primary.score * (1 - SECONDARY_MAX_GAP_FROM_PRIMARY) &&
    (third === undefined ||
      third.score <= secondary.score * (1 - SECONDARY_MIN_LEAD_OVER_THIRD));

  return qualifies ? { primary, secondary } : { primary };
}
