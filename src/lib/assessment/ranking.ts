import { tribes, type Tribe } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure view-model for the result page's 12-tribe ranking (issue #6). Given a set
 * of normalized tribe scores (ADR-0001), it ranks every tribe high-to-low and
 * pairs each with its full `Tribe` so the page can draw a labelled, accent-
 * coloured bar without re-deriving anything. Recomputed from the saved `words`
 * on the server, so the ranking can never drift from the stored result.
 *
 * Kept separate from the React page so the ordering and bar-width maths are
 * testable in isolation, with no DOM. Client-safe (no DB) but in practice only
 * the server result page consumes it.
 */
export interface RankedTribe {
  tribe: Tribe;
  /** The tribe's normalized 0–1 score (comparable across tribes, ADR-0001). */
  score: number;
  /**
   * Bar width as a 0–1 fraction of the leader's score, so the top tribe fills
   * the bar and the rest scale proportionally beneath it. Zero when nothing
   * scored. This is a linear scaling of `score`, so a tribe at half the leader's
   * normalized score draws a half-width bar.
   */
  fraction: number;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

/**
 * Rank a full set of tribe scores high-to-low for display. Ties keep canonical
 * (tribe `number`) order — the input arrives in that order and the sort is
 * stable — matching how `deriveResult` breaks ties, so the bars and the headline
 * never disagree.
 */
export function rankTribeScores(scores: TribeScore[]): RankedTribe[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  return ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      tribe,
      score: s.score,
      fraction: top > 0 ? s.score / top : 0,
    };
  });
}

/** Convenience: score the selected words and rank the result in one step. */
export function rankWords(words: readonly string[]): RankedTribe[] {
  return rankTribeScores(score(words));
}
