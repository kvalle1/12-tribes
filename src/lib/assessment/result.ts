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
 * A scored tribe shaped for the result page's ranking bars (#6): the normalized
 * `score`, a `fraction` (0–1) for the bar's proportional fill, the tribe's accent
 * `color`, and whether it is the headline Primary or Secondary.
 */
export interface RankedTribe {
  slug: string;
  name: string;
  /** Tailwind color name for the per-tribe accent (mapped to hex at render). */
  color: string;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** Bar fill relative to the top tribe (top = 1); 0 when every score is 0. */
  fraction: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

/**
 * Rank the 12 scored tribes for display: sort by score descending (ties keep the
 * input's canonical tribe order, since the sort is stable and `score()` returns
 * canonical order), flag the Primary/Secondary, and give each a `fraction` for a
 * proportional bar. Pure and client-safe — it takes already-computed scores and
 * never touches the word→tribe mapping, so the scoring stays server-side.
 */
export function buildRanking(
  scores: readonly TribeScore[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;

  return ranked.map((s) => ({
    slug: s.slug,
    name: s.name,
    color: tribeBySlug.get(s.slug)?.color ?? "",
    score: s.score,
    fraction: max > 0 ? s.score / max : 0,
    isPrimary: s.slug === primarySlug,
    isSecondary: secondarySlug != null && s.slug === secondarySlug,
  }));
}
