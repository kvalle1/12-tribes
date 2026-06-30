import type { TribeScore } from "./score";

/**
 * A tribe score prepared for the ranked-bar display on the result view (#6).
 * Pure and client-safe — no scoring, no word→tribe mapping — so the result page
 * and the profile page (#18) can rank an already-computed Strength Profile the
 * same way.
 */
export interface RankedTribeScore extends TribeScore {
  /**
   * Bar width as a percentage of the leader's bar, so the highest-scoring tribe
   * fills the track and the rest read proportionally against it. 0 when nothing
   * was earned (no division by zero).
   */
  widthPct: number;
  /** The normalized score as a 0–100 percentage of this tribe's available points. */
  percent: number;
}

/**
 * Rank the 12 tribe scores highest-first for display, computing each bar's
 * proportional width relative to the leader. The sort is stable, so ties keep
 * the input's canonical (tribe `number`) order — matching `deriveResult`.
 */
export function rankForDisplay(scores: readonly TribeScore[]): RankedTribeScore[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;

  return ranked.map((tribe) => ({
    ...tribe,
    widthPct: max > 0 ? (tribe.score / max) * 100 : 0,
    percent: Math.round(tribe.score * 100),
  }));
}
