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
 * One row of the 12-tribe ranking bars on the enriched result view (#6). Carries
 * everything the bar needs — the tribe's display name and accent `color`, its
 * normalized `score` (which both the bar width and the percentage label render
 * from, so they always agree), and whether it is the Subject's Primary/Secondary.
 */
export interface TribeBar {
  slug: string;
  name: string;
  /** Tailwind color name (e.g. "amber"), mapped to a hex accent by the page. */
  color: string;
  /** Normalized 0–1 score from the scoring core; drives both bar width and label. */
  score: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

/**
 * Rank every tribe's normalized score for display as proportional bars. Sorted
 * by score descending (ties keep canonical tribe order, matching `deriveResult`),
 * each bar renders directly from the normalized 0–1 `score`, so the bar width and
 * the percentage label are the same number rather than two scales that disagree.
 *
 * Pure and client-safe: it consumes already-computed `TribeScore`s (the page
 * scores `row.words` on the server) and only joins in each tribe's name/color, so
 * the word→tribe mapping never has to cross into this module or the client.
 */
export function rankedBars(
  scores: readonly TribeScore[],
  primarySlug: string,
  secondarySlug?: string | null,
): TribeBar[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);

  return ranked.map((s) => ({
    slug: s.slug,
    name: s.name,
    color: tribeBySlug.get(s.slug)?.color ?? "",
    score: s.score,
    isPrimary: s.slug === primarySlug,
    isSecondary: !!secondarySlug && s.slug === secondarySlug,
  }));
}
