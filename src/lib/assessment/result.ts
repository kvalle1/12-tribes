import { tribes, type Tribe } from "@/lib/tribes";

/**
 * Resolve a stored result's tribe slugs into the full `Tribe` objects the
 * headline renders. Pure and client-safe (no DB, no scoring) so the result page,
 * the profile page (#18), and the enriched result view (#6) can share it.
 */
export interface ResultHeadline {
  primary: Tribe;
  secondary?: Tribe;
}

/** A scored tribe with its full `Tribe` object attached, ready to render. */
export interface RankedTribe {
  tribe: Tribe;
  score: number;
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
 * Attach the full `Tribe` object to each scored slug for rendering the 12-tribe
 * ranking bars (issue #6), preserving the input order so a pre-ranked list stays
 * ranked. Pure and client-safe — it resolves against the `tribes` source of
 * truth and does no scoring (the scoring core stays server-only). Throws on an
 * unknown slug so a stale stored result surfaces loudly rather than rendering a
 * gap.
 */
export function resolveRanked(
  scores: readonly { slug: string; score: number }[],
): RankedTribe[] {
  return scores.map(({ slug, score }) => {
    const tribe = tribeBySlug.get(slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${slug}"`);
    return { tribe, score };
  });
}
