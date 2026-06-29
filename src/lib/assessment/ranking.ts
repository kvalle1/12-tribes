import { getTribeBySlug, type Tribe } from "@/lib/tribes";
import { score } from "./score";

/**
 * Rank the 12 tribes for the result page's ranking bars (issue #6). Pure and
 * derived entirely from the selected `words` via the scoring core, so the bars
 * can never drift from the stored result — `words` stays the single source of
 * truth (the saved row recomputes from it rather than persisting the ranking).
 *
 * Sorting mirrors `deriveResult`: a stable sort by normalized score descending,
 * ties keeping canonical (tribe `number`) order. Because both start from the
 * same `score(words)` and sort the same way, the tribe at rank 0 is always the
 * same tribe `deriveResult` names Primary — the bars and the headline agree.
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score (share of the tribe's available points). */
  score: number;
  /**
   * Bar fill relative to the leader (the top tribe is 1; a tribe scoring half
   * the leader is 0.5). 0 for every tribe when nothing scored. This keeps the
   * bars using the full width while preserving the relative gaps between tribes.
   */
  fraction: number;
}

export function rankTribes(words: readonly string[]): RankedTribe[] {
  // score() returns a fresh array; sort it in place (no extra copy needed).
  const ranked = score(words).sort((a, b) => b.score - a.score);
  const max = ranked[0]?.score ?? 0;

  return ranked.map((s) => {
    const tribe = getTribeBySlug(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      tribe,
      score: s.score,
      fraction: max > 0 ? s.score / max : 0,
    };
  });
}
