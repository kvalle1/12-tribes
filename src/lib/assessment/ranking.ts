import type { TribeScore } from "./score";

/**
 * Presentation helper for the result page's 12-tribe ranking (issue #6, PRD
 * story 11). Pure and client-safe — it imports only the `TribeScore` *type*
 * (erased at runtime), never the scoring core or the word→tribe mapping, so the
 * trust boundary (ADR-0009) holds even though this can run in a client bundle.
 *
 * Given the normalized 0–1 scores from `score()`, it ranks the tribes and
 * derives each one's bar width. The leader fills the bar and every other tribe
 * is drawn proportional to it, so the relative standing reads at a glance while
 * the underlying values stay the normalized scores from the scoring core.
 */
export interface RankedTribeScore extends TribeScore {
  /** 1-based position after sorting by score descending. */
  rank: number;
  /** Bar fill 0–100, proportional to the top score (the leader fills the bar). */
  barPercent: number;
}

export function rankScores(scores: readonly TribeScore[]): RankedTribeScore[] {
  // Stable sort: equal scores keep their incoming (canonical tribe) order, the
  // same tie-break the scoring core uses (`deriveResult`).
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked.length > 0 ? ranked[0].score : 0;

  return ranked.map((s, i) => ({
    ...s,
    rank: i + 1,
    barPercent: top > 0 ? (s.score / top) * 100 : 0,
  }));
}
