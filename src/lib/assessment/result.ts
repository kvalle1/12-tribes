import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "./score";

/**
 * Resolve a stored result's tribe slugs into the full `Tribe` objects the
 * headline renders. Pure and client-safe (no DB, no scoring) so the result page,
 * the profile page (#18), and the enriched result view (#6) can share it.
 *
 * `TribeScore` is imported as a type only — that import is erased at compile
 * time, so this module stays free of the `server-only` scoring/mapping code and
 * remains safe to use from a client bundle.
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
 * A tribe's normalized score paired with its accent color name, for the
 * 12-tribe ranking bars on the enriched result view (#6).
 */
export interface RankedTribe {
  slug: string;
  name: string;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** Tailwind color name (e.g. "amber"), the accent for this tribe's bar. */
  color: string;
}

/**
 * Rank every tribe's normalized score highest-first for display, attaching each
 * tribe's accent color from the `tribes` source of truth. The input is copied
 * before sorting, so the caller's array is left untouched. Ties keep the input's
 * canonical (tribe `number`) order — the scoring core emits scores in that order
 * and `Array.prototype.sort` is stable — so the ranking is deterministic.
 */
export function rankTribes(scores: readonly TribeScore[]): RankedTribe[] {
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      score: s.score,
      color: tribeBySlug.get(s.slug)?.color ?? "",
    }));
}
