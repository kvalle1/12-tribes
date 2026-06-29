import { score, type TribeScore } from "./score";

/**
 * A tribe's normalized score plus the bar width for the result view's ranked
 * bars (issue #6).
 */
export interface RankedTribe extends TribeScore {
  /** Bar width as a fraction (0–1) of the top-ranked tribe's score. */
  fraction: number;
}

/**
 * Rank all 12 tribes by their normalized score (descending) for the result
 * view's proportional bars. `fraction` is each tribe's score relative to the
 * top tribe's, so the leader fills the bar and the rest read proportionally; an
 * empty or all-zero selection yields all-zero fractions (no divide-by-zero).
 *
 * Sorting is stable and `score()` returns tribes in canonical (`number`) order,
 * so tied scores keep that order — matching `deriveResult`, so the ranked bars
 * and the headline never disagree about ordering.
 */
export function rankTribes(words: readonly string[]): RankedTribe[] {
  const scores = score(words);
  const top = Math.max(0, ...scores.map((s) => s.score));
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s) => ({ ...s, fraction: top > 0 ? s.score / top : 0 }));
}
