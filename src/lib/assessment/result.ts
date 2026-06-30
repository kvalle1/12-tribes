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
 * A single tribe's place in the ranked-bar chart on the result page (issue #6),
 * pairing the full `Tribe` with its normalized score and a bar width.
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /**
   * Bar width as a 0–1 fraction, proportional to the top-scoring tribe so the
   * leader fills the track and the rest scale relative to it. `0` for every
   * tribe when nothing scored (so an empty selection draws no bars).
   */
  barFraction: number;
}

/**
 * Rank the 12 tribe scores highest-first for display as proportional bars. Pure
 * and client-safe: it takes already-computed scores (scoring itself is
 * server-only) and only joins them to the client-safe `tribes` metadata, so the
 * word→tribe mapping never reaches the client. Ranking ties keep canonical
 * (tribe `number`) order, matching `deriveResult`.
 */
export function rankScores(scores: TribeScore[]): RankedTribe[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  return ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      tribe,
      score: s.score,
      barFraction: top > 0 ? s.score / top : 0,
    };
  });
}
