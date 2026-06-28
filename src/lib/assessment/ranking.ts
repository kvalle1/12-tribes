import { tribes, type Tribe } from "@/lib/tribes";
import { score } from "./score";

/**
 * Build the ranked view model for the enriched result page (issue #6): every one
 * of the 12 tribes, ordered by normalized score, each carrying the bar geometry
 * and the metadata its row renders from.
 *
 * The ranking is recomputed from the Subject's saved `words` by the pure scoring
 * core, so the saved row stays the single source of truth and the displayed bars
 * can never drift from it. Because `score` (transitively `words.ts`) is
 * server-only, this module is too — keeping the word→tribe mapping off the
 * client (ADR-0009 trust boundary). It returns only plain numbers and tribe
 * content, so a server component can render it without leaking the mapping.
 *
 * `score` is the absolute normalized 0–1 value (points earned ÷ points
 * available, ADR-0001). `barFraction` scales that to the top-scoring tribe so the
 * leader fills the bar and the rest are proportional to it — the visual width,
 * kept distinct from the honest `percent` label so the page can show both.
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score from the scoring core (absolute, ADR-0001). */
  score: number;
  /** Rounded display percentage of the normalized score. */
  percent: number;
  /** Bar width as a fraction of the top-scoring tribe (0–1); 0 when all are 0. */
  barFraction: number;
  /** 1-based position in the descending ranking. */
  rank: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function rankResult(
  words: readonly string[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  // Stable sort by score desc; ties keep canonical (tribe `number`) order,
  // matching `deriveResult` so the bars and the headline never disagree.
  const ranked = [...score(words)].sort((a, b) => b.score - a.score);
  const max = ranked[0]?.score ?? 0;

  return ranked.map((s, i) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      tribe,
      score: s.score,
      percent: Math.round(s.score * 100),
      barFraction: max > 0 ? s.score / max : 0,
      rank: i + 1,
      isPrimary: s.slug === primarySlug,
      isSecondary: !!secondarySlug && s.slug === secondarySlug,
    };
  });
}
