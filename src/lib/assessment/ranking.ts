import type { TribeScore } from "./score";

/**
 * Presentation helper for the result page's 12-tribe ranking bars (issue #6).
 *
 * Pure and client-safe — it takes the already-computed normalized `TribeScore[]`
 * (from the server-only scoring core) plus the Primary/Secondary slugs, and turns
 * them into the rows the bars render: ranked high→low, each with a bar width and
 * a percentage label, and flagged when it is the Primary or Secondary.
 *
 * Keeping this separate from `score.ts` means no word→tribe mapping is needed to
 * lay out the bars, so this can be imported wherever the scores already exist.
 */
export interface RankedScore {
  slug: string;
  name: string;
  /** Normalized 0–1 score, straight from the scoring core. */
  score: number;
  /** `score` as a rounded 0–100 percentage, for the row's label. */
  percent: number;
  /**
   * Bar width as a 0–1 fraction, scaled so the top-scoring tribe fills the bar
   * and the rest are proportional to it. This keeps the ranking legible when the
   * absolute normalized scores are all modest; the `percent` label still carries
   * the true normalized value. 0 for every tribe when nothing scored.
   */
  barFraction: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

/**
 * Rank a set of tribe scores for display. Sorts by score descending; ties keep
 * the input's canonical (tribe `number`) order, matching `deriveResult`, so the
 * bars stay deterministic. Bar widths are relative to the highest score.
 */
export function rankScores(
  scores: readonly TribeScore[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedScore[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked.length > 0 ? ranked[0].score : 0;

  return ranked.map((entry) => ({
    slug: entry.slug,
    name: entry.name,
    score: entry.score,
    percent: Math.round(entry.score * 100),
    barFraction: top > 0 ? entry.score / top : 0,
    isPrimary: entry.slug === primarySlug,
    isSecondary: !!secondarySlug && entry.slug === secondarySlug,
  }));
}
