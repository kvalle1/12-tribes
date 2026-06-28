import { tribes } from "@/lib/tribes";
import { score } from "./score";

/**
 * Pure display helper for the enriched result view (issue #6). Turns a Subject's
 * selected words into the ranked, render-ready rows the result page draws as
 * bars — one per tribe, sorted strongest first — plus the per-tribe accent color
 * and the Primary/Secondary flags.
 *
 * It builds on the pure scoring core (`score`) and adds only presentation: the
 * sort, a bar fraction relative to the top score (so the leader fills the bar
 * and the rest scale against it), a rounded display percentage, and the accent
 * hex. No DB and no word→tribe mapping is exposed, so the result page can compute
 * the whole ranking on the server from the stored `words` alone.
 */

export type RankBadge = "primary" | "secondary" | null;

export interface RankedTribe {
  slug: string;
  name: string;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** `score` as a rounded whole percentage, for display. */
  percent: number;
  /** Width of the bar fill, 0–1, relative to the highest-scoring tribe. */
  barFraction: number;
  /** Accent hex for this tribe (see `accentHex`). */
  accent: string;
  /** Whether this tribe is the result's Primary, Secondary, or neither. */
  badge: RankBadge;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

/**
 * Build the ranked, render-ready rows for all 12 tribes from a Subject's
 * selected words and their derived Primary/Secondary slugs. Sorted by score
 * descending; ties keep canonical (tribe `number`) order, since `score` returns
 * canonical order and the sort is stable.
 */
export function buildRanking(
  selectedWords: readonly string[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  const ranked = [...score(selectedWords)].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  return ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    const badge: RankBadge =
      s.slug === primarySlug
        ? "primary"
        : secondarySlug && s.slug === secondarySlug
          ? "secondary"
          : null;
    return {
      slug: s.slug,
      name: s.name,
      score: s.score,
      percent: Math.round(s.score * 100),
      barFraction: top > 0 ? s.score / top : 0,
      accent: accentHex(tribe?.color ?? ""),
      badge,
    };
  });
}

/**
 * Maps a tribe's Tailwind color name to its accent hex. Mirrors the maps in
 * `page.tsx` and the tribe detail page; a missing key falls back to brass.
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
