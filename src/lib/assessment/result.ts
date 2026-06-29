import { tribes, type Tribe } from "@/lib/tribes";
import { type TribeScore } from "./score";

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

/**
 * A tribe's normalized score plus the display metadata and bar geometry the
 * enriched result view (#6) needs to render the 12-tribe ranking. Carries only
 * already-computed numbers and public tribe fields — no word→tribe mapping — so
 * it is safe to hand to a presentational component (ADR-0009 trust boundary).
 */
export interface RankedTribe {
  slug: string;
  name: string;
  callSign: string;
  color: string;
  /** Accent hex resolved from `color`, ready for inline `--accent`. */
  accent: string;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** Bar width as a fraction of the top score (0–1); the leader is 1. */
  relative: number;
}

/**
 * Rank a set of tribe scores high-to-low for display, enriching each with its
 * tribe metadata and a `relative` bar width measured against the top score.
 * Pure and client-safe — it takes scores already computed by the (server-side)
 * scoring core, so the mapping never travels here. Ties keep the canonical
 * (tribe `number`) order via a stable sort.
 */
export function rankTribes(scores: TribeScore[]): RankedTribe[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      slug: tribe.slug,
      name: tribe.name,
      callSign: tribe.callSign,
      color: tribe.color,
      accent: accentHex(tribe.color),
      score: s.score,
      relative: top > 0 ? s.score / top : 0,
    };
  });
}

/**
 * Map a tribe's Tailwind color name to its accent hex. Shared by the result
 * views (mirrors the maps in `page.tsx` and the tribe detail page); a missing
 * key falls back to brass.
 */
export function accentHex(color: string): string {
  const map: Record<string, string> = {
    amber: "#b8860b",
    violet: "#7c5cbf",
    blue: "#2f6fb0",
    emerald: "#2f8f63",
    orange: "#c2691f",
    red: "#b23535",
    slate: "#6b7280",
    cyan: "#1f97aa",
    lime: "#6f9420",
    zinc: "#7c7c85",
    yellow: "#b8961a",
    rose: "#bf3a52",
  };
  return map[color] ?? "#a9842f";
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
