import type { TribeScore } from "./score";

/**
 * A tribe score positioned for display: its 1-based rank and a bar width as a
 * percentage of the top score, so the result view (issue #6) can draw
 * proportional bars for all 12 tribes without re-deriving the maximum itself.
 */
export interface RankedTribeScore extends TribeScore {
  /** 1-based rank position (1 = highest score). */
  rank: number;
  /** Bar width as a percentage of the top score, 0–100. */
  barPercent: number;
}

/**
 * Rank tribe scores highest-first and size each bar relative to the top score.
 * Pure and dependency-free (no DB, no scoring): the page re-scores the saved
 * words with `score()` and passes the result here. Ties keep the input's
 * canonical (tribe `number`) order via a stable sort, and when every score is 0
 * all bars are 0 (no division by zero).
 */
export function rankScores(scores: TribeScore[]): RankedTribeScore[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked[0]?.score ?? 0;
  return ranked.map((s, i) => ({
    ...s,
    rank: i + 1,
    barPercent: max > 0 ? (s.score / max) * 100 : 0,
  }));
}
