import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "./score";

/**
 * Resolve a stored result's tribe slugs into the full `Tribe` objects the
 * headline renders. Pure and client-safe (no DB, no scoring) so the result page,
 * the profile page (#18), and the enriched result view (#6) can share it.
 */
export interface ResultHeadline {
  primary: Tribe;
  secondary?: Tribe;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function resolveHeadline(
  primarySlug: string,
  secondarySlug?: string | null,
): ResultHeadline {
  const primary = tribeBySlug.get(primarySlug);
  if (!primary) {
    throw new Error(`Unknown primary tribe slug "${primarySlug}"`);
  }
  const secondary = secondarySlug
    ? tribeBySlug.get(secondarySlug)
    : undefined;
  return { primary, secondary };
}

/**
 * One tribe's row in the ranked result bars (#6): the full `Tribe` object plus
 * its normalized 0–1 score and that score as a 0–100 integer for the percentage
 * label and the proportional bar width.
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** `score` as a 0–100 integer — the display percentage and the bar width %. */
  percent: number;
}

/**
 * Rank a full set of tribe scores for display: highest score first, ties keeping
 * canonical (tribe `number`) order so the bars are deterministic. Each entry is
 * resolved to its full `Tribe` (for name, Hebrew, and accent color) and carries
 * a rounded percentage. Pure and client-safe — it depends only on the `tribes`
 * source of truth, never on the server-only scoring/word data — so the scores
 * are computed on the server and only the resolved ranking crosses into the view.
 *
 * Throws on an unknown slug rather than silently dropping a tribe, so a drift
 * between the scoring core and `tribes` surfaces loudly instead of as a missing
 * bar.
 */
export function buildRanking(scores: readonly TribeScore[]): RankedTribe[] {
  // Array.prototype.sort is stable, so equal scores keep the input's canonical
  // order (the scoring core emits tribes in `number` order).
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s) => {
      const tribe = tribeBySlug.get(s.slug);
      if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
      return { tribe, score: s.score, percent: Math.round(s.score * 100) };
    });
}
