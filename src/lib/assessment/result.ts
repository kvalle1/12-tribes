import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "./score";

/**
 * Resolve a stored result's tribe slugs into the full `Tribe` objects the
 * headline renders. Pure and client-safe (no DB, no scoring) so the result page,
 * the profile page (#18), and the enriched result view (#6) can share it.
 *
 * `TribeScore` is imported as a type only, so this module never pulls in the
 * (server-only) scoring core or the word→tribe mapping — the result page computes
 * the scores on the server and hands the array here purely for display.
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

/** One tribe's place in the result page's 12-tribe ranking. */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score (the value the scoring core produced). */
  score: number;
  /** Whether this tribe is the headline Primary, Secondary, or neither. */
  role: "primary" | "secondary" | null;
}

/**
 * Resolve scored slugs into ranked `Tribe` objects for the result page's bars
 * (issue #6, PRD story 11). Returns every tribe sorted best-first, each tagged
 * with its full `Tribe` and its Primary/Secondary role so the view can highlight
 * the headline tribes. Score ties keep canonical (tribe `number`) order — the
 * scoring core emits scores in that order and the sort below is stable — so the
 * ranking is deterministic.
 *
 * Pure and client-safe: it takes the already-computed scores rather than the
 * words, so the word→tribe mapping never crosses the server boundary.
 */
export function rankTribes(
  scores: TribeScore[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  if (!tribeBySlug.has(primarySlug)) {
    throw new Error(`Unknown primary tribe slug "${primarySlug}"`);
  }

  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map(({ slug, score }) => {
      const tribe = tribeBySlug.get(slug);
      if (!tribe) throw new Error(`Unknown tribe slug "${slug}"`);
      const role =
        slug === primarySlug
          ? "primary"
          : secondarySlug && slug === secondarySlug
            ? "secondary"
            : null;
      return { tribe, score, role };
    });
}
