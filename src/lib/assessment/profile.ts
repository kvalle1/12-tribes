import { tribes, type Tribe } from "@/lib/tribes";
import { score } from "./score";

/**
 * Join the pure normalized scores (ADR-0001) to the full `Tribe` objects and
 * rank them for display — the data behind the enriched result view's 12-tribe
 * ranking bars (issue #6). Pure and client-safe (no DB), built on the same
 * scoring core the headline uses, so the bars can never drift from the saved
 * Primary/Secondary: both derive from the Subject's stored `words`.
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score for this tribe (from the scoring core). */
  score: number;
  /**
   * Width fraction (0–1) relative to the top-ranked tribe, for a proportional
   * bar. The leader is always 1; everything else scales to it. 0 for every
   * tribe when nothing scored.
   */
  barFraction: number;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

/**
 * Rank a selection's tribe scores highest-first for the bar chart. Ties keep
 * canonical (tribe `number`) order — the stable sort preserves the scoring
 * core's canonical ordering — so the ranking matches `deriveResult`'s headline
 * deterministically.
 */
export function rankProfile(selectedWords: readonly string[]): RankedTribe[] {
  const ranked = [...score(selectedWords)].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return ranked.map((s) => ({
    tribe: tribeBySlug.get(s.slug)!,
    score: s.score,
    barFraction: top > 0 ? s.score / top : 0,
  }));
}
