import { tribes, type Tribe } from "@/lib/tribes";
// Type-only import: erased at build time, so this module never pulls in the
// server-only word→tribe mapping behind `score.ts` and stays client-safe.
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
 * A tribe paired with its normalized score and result role — the unit the
 * 12-tribe ranking bars on the result page (#6) render. `score` is the same
 * normalized 0–1 value the scoring core produces (ADR-0001).
 */
export interface RankedTribe {
  tribe: Tribe;
  score: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

/**
 * Rank every tribe by its normalized score, highest first, tagging the Primary
 * and (when present) Secondary so the view can highlight them. Ties keep
 * canonical (tribe `number`) order — the sort is stable and `scores` arrives in
 * canonical order from the scoring core — so the ranking is deterministic and
 * matches the headline derivation.
 *
 * Pure and client-safe: it takes already-computed `TribeScore[]` rather than the
 * raw words, so the server-only scoring/mapping never has to reach the client.
 */
export function rankTribes(
  scores: readonly TribeScore[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s) => {
      const tribe = tribeBySlug.get(s.slug);
      if (!tribe) {
        throw new Error(`Unknown tribe slug "${s.slug}"`);
      }
      return {
        tribe,
        score: s.score,
        isPrimary: s.slug === primarySlug,
        isSecondary: Boolean(secondarySlug) && s.slug === secondarySlug,
      };
    });
}
