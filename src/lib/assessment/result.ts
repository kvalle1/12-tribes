import { getTribeBySlug, type Tribe } from "@/lib/tribes";

/**
 * Resolve a stored result's tribe slugs into the full `Tribe` objects the
 * headline renders. Pure and client-safe (no DB, no scoring) so the result page,
 * the profile page (#18), and the enriched result view (#6) can share it.
 */
export interface ResultHeadline {
  primary: Tribe;
  secondary?: Tribe;
}

export function resolveHeadline(
  primarySlug: string,
  secondarySlug?: string | null,
): ResultHeadline {
  const primary = getTribeBySlug(primarySlug);
  if (!primary) {
    throw new Error(`Unknown primary tribe slug "${primarySlug}"`);
  }
  const secondary = secondarySlug
    ? getTribeBySlug(secondarySlug)
    : undefined;
  return { primary, secondary };
}
