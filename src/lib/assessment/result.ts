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
 * A scored tribe paired with its display metadata and ranking, ready for the
 * result view's 12-tribe bars (PRD story 11). Pure and client-safe — built from
 * already-computed `TribeScore`s (scoring stays server-side, ADR-0009).
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score (coverage-fair, ADR-0001). */
  score: number;
  /** The score as a 0–100 whole percent, for the readout beside each bar. */
  percent: number;
  /**
   * Bar width as a 0–1 fraction of the top tribe's score, so the leader fills
   * the bar and the rest read proportionally against it. Zero for every tribe
   * when nothing scored (no divide-by-zero).
   */
  fraction: number;
  /** 1-based position after sorting. */
  rank: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

/**
 * Rank all 12 tribes for display: sort by score descending (ties keep canonical
 * tribe order, since the input is canonically ordered and the sort is stable),
 * attach each tribe's metadata, and compute the per-bar fraction and percent.
 * The Primary/Secondary slugs (the saved headline) are flagged so the view can
 * highlight them. Pure — no DB, no scoring, no `tribes.ts` drift.
 */
export function buildRanking(
  scores: TribeScore[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return ranked.map((s, index) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) {
      throw new Error(`Unknown tribe slug "${s.slug}" in scores`);
    }
    return {
      tribe,
      score: s.score,
      percent: Math.round(s.score * 100),
      fraction: top > 0 ? s.score / top : 0,
      rank: index + 1,
      isPrimary: s.slug === primarySlug,
      isSecondary: !!secondarySlug && s.slug === secondarySlug,
    };
  });
}
