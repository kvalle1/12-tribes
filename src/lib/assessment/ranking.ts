import type { TribeScore } from "./score";

/**
 * A tribe score prepared for the result page's ranking chart: the normalized
 * score plus a `widthPct` (0–100) scaled so the top-scoring tribe fills the
 * track. Scaling to the leader keeps every bar proportional to one another
 * (all divided by the same maximum) while making a chart of small normalized
 * scores readable.
 */
export interface RankedBar extends TribeScore {
  /** Bar width as a percentage of the track, 0–100, relative to the top score. */
  widthPct: number;
}

/**
 * Rank tribe scores highest-first for display, attaching a proportional bar
 * width to each. Pure and presentation-only — it derives nothing, it just
 * arranges the scores `score()` already produced, so it is safe to run on either
 * side of the trust boundary. Ties keep the input's canonical (tribe `number`)
 * order, matching `deriveResult`.
 */
export function rankBars(scores: TribeScore[]): RankedBar[] {
  const max = scores.reduce((m, s) => Math.max(m, s.score), 0);
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s) => ({
      ...s,
      widthPct: max > 0 ? (s.score / max) * 100 : 0,
    }));
}
