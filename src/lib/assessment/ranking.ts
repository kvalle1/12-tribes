import { tribes, type Tribe } from "@/lib/tribes";
import { score } from "./score";

/**
 * Display helper for the enriched result view (#6). Turns a saved selection into
 * ranked rows for all 12 tribes — the data the result page renders as the
 * "why you got this" bar chart.
 *
 * It pulls in `score` (and so, transitively, the server-only word→tribe mapping
 * in `words.ts`), which keeps the scoring data off the client: this module can
 * only be imported into a server component, exactly like the rest of the
 * scoring core (ADR-0009 trust boundary).
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** `score` rounded to an integer percent, for the display label. */
  percent: number;
  /** Bar width relative to the top-ranked tribe (0–1); the leader fills the bar. */
  barFraction: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

/**
 * Rank a saved selection's tribe scores for display. Returns one row per tribe,
 * sorted by normalized score (highest first; ties keep canonical `number` order
 * because `score` emits that order and the sort is stable). `barFraction` is each
 * score relative to the leader's, so the chart reads well regardless of the
 * absolute scale, while `percent` reports the underlying normalized value. The
 * `primarySlug`/`secondarySlug` come from the saved result so the flags match the
 * headline exactly rather than being re-derived here.
 */
export function rankResultScores(
  words: readonly string[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  const ranked = [...score(words)].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      tribe,
      score: s.score,
      percent: Math.round(s.score * 100),
      barFraction: top > 0 ? s.score / top : 0,
      isPrimary: s.slug === primarySlug,
      isSecondary: secondarySlug != null && s.slug === secondarySlug,
    };
  });
}
