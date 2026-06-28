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

/** A tribe score with its rank and the bar width used to render the spectrum. */
export interface RankedTribeScore extends TribeScore {
  /** 1-based rank, highest score first. */
  rank: number;
  /** Bar fill as a 0–100 percentage, scaled so the top score fills the bar. */
  fillPct: number;
}

/**
 * Rank the 12 normalized tribe scores for the result spectrum (#6, PRD story
 * 11): highest first, with bar widths scaled to the leader so the ranking reads
 * at a glance. Pure and input-preserving. The sort is stable, so tie scores keep
 * the scoring core's canonical (tribe `number`) order — the same deterministic
 * tie-break `deriveResult` uses. The type-only `TribeScore` import keeps this
 * client-safe: it never pulls the server-only word→tribe mapping.
 */
export function rankTribeScores(
  scores: readonly TribeScore[],
): RankedTribeScore[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked.length > 0 ? ranked[0].score : 0;
  return ranked.map((s, i) => ({
    ...s,
    rank: i + 1,
    fillPct: top > 0 ? (s.score / top) * 100 : 0,
  }));
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
