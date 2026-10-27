import type { TribeScore } from "./score";

/**
 * A scored tribe with the bar-fill fraction the result view uses to draw its
 * ranking bar. `relative` is the tribe's score as a fraction of the highest
 * score in the set, so the top tribe always fills the bar and the rest are drawn
 * in proportion to it — the chart stays readable even when the absolute
 * normalized scores are all small. Pure and client-safe (no scoring, no
 * server-only imports) so the result view can import it directly.
 */
export interface RankedTribe extends TribeScore {
  /** 0–1 bar-fill fraction relative to the top-scoring tribe. */
  relative: number;
}

/**
 * Rank tribe scores highest-first for display, attaching each tribe's bar-fill
 * fraction. Ties keep the input's canonical (tribe `number`) order, matching the
 * deterministic ordering `deriveResult` relies on. The input is not mutated.
 */
export function rankScores(scores: readonly TribeScore[]): RankedTribe[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;
  return ranked.map((tribe) => ({
    ...tribe,
    relative: max > 0 ? tribe.score / max : 0,
  }));
}
