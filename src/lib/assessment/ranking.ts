import type { TribeScore } from "./score";

/**
 * Presentation helper for the enriched result view (issue #6). Pure and
 * client-safe — it takes the normalized tribe scores the scoring core already
 * produced (no word→tribe mapping, no DB) and shapes them into ranked bars.
 *
 * Kept separate from the scoring core so the rendering concern (sort order,
 * display percentage, proportional bar width) stays out of the math and can be
 * unit-tested on its own.
 */
export interface RankedBar extends TribeScore {
  /** The normalized score as a rounded 0–100 percentage, for the label. */
  percent: number;
  /**
   * Bar width as a 0–100 percentage of the top-ranked score, so the leader
   * fills the track and the rest are proportional to it. Ratios between bars
   * are preserved, which keeps the comparison honest even when no tribe scored
   * near 1.0.
   */
  relativeWidth: number;
}

/**
 * Rank tribe scores highest-first and attach display geometry. The sort is
 * stable, so ties keep the canonical (tribe `number`) order the scoring core
 * emits — matching how `deriveResult` breaks ties. An all-zero selection yields
 * zero-width bars rather than dividing by zero.
 */
export function toRankedBars(scores: TribeScore[]): RankedBar[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return ranked.map((tribe) => ({
    ...tribe,
    percent: Math.round(tribe.score * 100),
    relativeWidth: top > 0 ? (tribe.score / top) * 100 : 0,
  }));
}
