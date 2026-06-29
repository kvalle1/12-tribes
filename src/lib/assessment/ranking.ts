import { tribes, type Tribe } from "@/lib/tribes";
import { score } from "./score";

/**
 * Rank all 12 tribes by their normalized score for display on the result page
 * (issue #6). Pure and client-safe — it composes the scoring core over the
 * Subject's stored `words`, so the ranking the result page shows can never drift
 * from the saved selection (the schema keeps `words` as the source of truth).
 *
 * Each entry carries the full `Tribe` (for name, accent color, and the profile
 * link), the normalized 0–1 `score`, and a `relative` width — the score as a
 * fraction of the top-ranked tribe's score — so the bars read as a clean ranking
 * regardless of the absolute coverage-normalized magnitudes.
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** Score relative to the top-ranked tribe (0–1), for proportional bar widths. */
  relative: number;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function rankTribes(selectedWords: readonly string[]): RankedTribe[] {
  // `score` returns all 12 tribes in canonical order; Array#sort is stable, so
  // equal scores keep that canonical order.
  const ranked = [...score(selectedWords)].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;

  return ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      tribe,
      score: s.score,
      relative: max > 0 ? s.score / max : 0,
    };
  });
}
