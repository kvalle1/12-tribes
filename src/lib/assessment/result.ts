import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "./score";

/**
 * Resolve a stored result's tribe slugs into the full `Tribe` objects the
 * headline renders. Pure and client-safe (no DB, no scoring) so the result page,
 * the profile page (#18), and the enriched result view (#6) can share it.
 *
 * The `TribeScore` import above is type-only (erased at compile time), so this
 * module stays client-safe even though `score.ts` pulls in the `server-only`
 * word→tribe mapping.
 */
export interface ResultHeadline {
  primary: Tribe;
  secondary?: Tribe;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

/**
 * Rank tribe scores highest-first for the result view's bars. A stable sort, so
 * ties keep the input's canonical (tribe `number`) order — matching how
 * `deriveResult` picks the Primary, and keeping the rendered ranking
 * deterministic. Returns a new array; the input is not mutated.
 */
export function rankByScore(scores: readonly TribeScore[]): TribeScore[] {
  return [...scores].sort((a, b) => b.score - a.score);
}

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
