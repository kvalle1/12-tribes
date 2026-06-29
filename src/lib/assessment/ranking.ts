import type { TribeScore } from "./score";

/** A tribe's normalized score plus its 1-based position in the ranked result view (#6). */
export interface RankedTribe extends TribeScore {
  /** 1-based position after sorting by score descending. */
  rank: number;
}

/**
 * Rank every tribe by normalized score, descending, for the result view's bars.
 * Pure and client-safe — it only reshapes the scores from `score()`. Ties keep
 * the input's canonical (tribe `number`) order via a stable sort, matching
 * `deriveResult`, so the ordering is deterministic. The bar width is the
 * normalized `score` itself (0–1), so the bar and its percentage label agree.
 */
export function rankScores(scores: TribeScore[]): RankedTribe[] {
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}
