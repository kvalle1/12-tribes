import { tribes, type Tribe } from "@/lib/tribes";
// Type-only import: erased at compile time, so this client-safe module never
// pulls in the `server-only` scoring core (`score.ts` → `words.ts`).
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
 * One tribe's row in the ranked result bars (#6). Carries the full `Tribe` (for
 * name, Hebrew, accent color, and profile link), the normalized 0–1 `score`, a
 * `percent` bar width, and whether this tribe is the stored Primary/Secondary.
 */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score (coverage of this tribe's available points). */
  score: number;
  /**
   * Bar width 0–100, proportional to the top-scoring tribe — the leader fills
   * the track and every other tribe is shown relative to it. Ordering by
   * `percent` is identical to ordering by `score`, so the ranking is by
   * normalized score (ADR-0001).
   */
  percent: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

/**
 * Turn the 12 normalized tribe scores into display rows for the result page:
 * sorted highest-first, each with a proportional bar width and the Primary /
 * Secondary flags taken from the stored result. Pure and client-safe — it takes
 * already-computed `TribeScore[]` (the server computes them with the scoring
 * core), so no scoring or word→tribe mapping crosses into the client.
 */
export function rankTribes(
  scores: readonly TribeScore[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;

  return ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) {
      throw new Error(`Unknown tribe slug "${s.slug}"`);
    }
    return {
      tribe,
      score: s.score,
      percent: max > 0 ? (s.score / max) * 100 : 0,
      isPrimary: s.slug === primarySlug,
      isSecondary: Boolean(secondarySlug) && s.slug === secondarySlug,
    };
  });
}
