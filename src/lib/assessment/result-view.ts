import { tribes, type Tribe } from "@/lib/tribes";
import { type TribeScore } from "./score";

/**
 * Pure presenter for the enriched assessment result view (issue #6): turns the
 * stored result — the Subject's selected words plus the recomputed 12-tribe
 * `TribeScore[]` and the headline Primary/Secondary slugs — into the ranked-bar
 * model the result page renders.
 *
 * It is deliberately client-safe (no `server-only`, no DB, no word→tribe
 * mapping): it takes scores that were computed on the server and only reads the
 * client-safe `tribes` metadata for names and accent colors. That keeps the
 * trust boundary intact (ADR-0009) while letting both the post-submit result
 * page and the profile page (#18) share one rendering from one stored row, so
 * the view can never drift between the two entry points.
 */

/** One tribe's row in the ranked-bar display. */
export interface RankedTribe {
  slug: string;
  name: string;
  /** Normalized 0–1 score, the source of the ranking (ADR-0001). */
  score: number;
  /** `score` as a rounded 0–100 integer for display. */
  percent: number;
  /** Bar width 0–1, relative to the top-ranked tribe (the leader fills the track). */
  barFraction: number;
  /** Per-tribe accent hex for the bar and labels. */
  accent: string;
  /** Set when this tribe is the stored headline Primary/Secondary. */
  role?: "primary" | "secondary";
}

export interface ResultView {
  /** All 12 tribes, highest normalized score first (canonical tie-break). */
  ranking: RankedTribe[];
  /** The headline Primary, resolved from the stored slug. */
  primary: RankedTribe;
  /** The headline Secondary, when the stored result named one. */
  secondary?: RankedTribe;
  /** The words the Subject selected, passed through unchanged. */
  words: string[];
}

const tribeBySlug = new Map<string, Tribe>(tribes.map((t) => [t.slug, t]));

/**
 * Maps a tribe's Tailwind color name to its accent hex. Mirrors the maps in
 * `page.tsx` and the tribe detail page; when adding a tribe or color, keep all
 * three in step (per CLAUDE.md). Falls back to brass for an unknown color.
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

/**
 * Build the ranked-bar view model from a scored result.
 *
 * `scores` is the full 12-tribe table in canonical (tribe `number`) order, as
 * `score()` returns it; `primarySlug`/`secondarySlug` are the stored headline so
 * the bars mark exactly the tribes the headline names (rather than recomputing
 * and risking a mismatch). Ranking sorts by score descending with a stable
 * tie-break that preserves canonical order, matching `deriveResult`.
 */
export function buildResultView(
  scores: TribeScore[],
  primarySlug: string,
  secondarySlug: string | null | undefined,
  words: readonly string[],
): ResultView {
  // Stable sort by score desc; ties keep the input's canonical order.
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const maxScore = ranked.length > 0 ? ranked[0].score : 0;

  const ranking: RankedTribe[] = ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      slug: s.slug,
      name: s.name,
      score: s.score,
      percent: Math.round(s.score * 100),
      barFraction: maxScore > 0 ? s.score / maxScore : 0,
      accent: accentHex(tribe.color),
      role:
        s.slug === primarySlug
          ? "primary"
          : secondarySlug && s.slug === secondarySlug
            ? "secondary"
            : undefined,
    };
  });

  const primary = ranking.find((r) => r.role === "primary");
  if (!primary) throw new Error(`Unknown primary tribe slug "${primarySlug}"`);
  const secondary = ranking.find((r) => r.role === "secondary");

  return { ranking, primary, secondary, words: [...words] };
}
