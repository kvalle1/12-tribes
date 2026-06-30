import "server-only";
import { tribes, type Tribe } from "@/lib/tribes";
import { resolveHeadline } from "./result";
import { score } from "./score";

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

/**
 * The view model for the enriched Self Assessment result (issue #6): the headline
 * Primary/Secondary plus the full 12-tribe ranking, recomputed from the stored
 * `words` by the pure scoring core so the ranking can never drift from the saved
 * selection (the schema keeps `words` as the source of truth — see `db/schema.ts`).
 *
 * This module is the shared core behind both the post-submit result page and the
 * profile page (#18); both render the same `<ResultView>` from this model. It is
 * `server-only` because it pulls in the word→tribe mapping via `score()`, which
 * must never reach the client (ADR-0009 trust boundary).
 */

export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score for this tribe (ADR-0001). */
  score: number;
  /** `score` as a 0–100 integer, for display. */
  percent: number;
  /** This tribe's score relative to the leader's (0–1) — the bar fill fraction. */
  barFraction: number;
  /** The per-tribe accent hex, for the bar colour. */
  accent: string;
  isPrimary: boolean;
  isSecondary: boolean;
}

export interface ResultViewModel {
  primary: Tribe;
  secondary?: Tribe;
  /** All 12 tribes, ranked by descending normalized score. */
  ranked: RankedTribe[];
  /** The words the Subject selected, in their stored order. */
  words: string[];
}

/**
 * Build the result view model from a stored result. `score()` returns the 12
 * tribes in canonical (tribe `number`) order; sorting is stable, so ties keep
 * that canonical order and the ranking is deterministic. `primarySlug` is
 * resolved (and throws on a corrupt unknown slug) so the headline always matches
 * the saved result rather than being re-derived here.
 */
export function buildResultView(
  words: readonly string[],
  primarySlug: string,
  secondarySlug?: string | null,
): ResultViewModel {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);

  const ranked = [...score(words)].sort((a, b) => b.score - a.score);
  const leader = ranked[0]?.score ?? 0;

  return {
    primary,
    secondary,
    words: [...words],
    ranked: ranked.map((s) => {
      const tribe = tribeBySlug.get(s.slug)!;
      return {
        tribe,
        score: s.score,
        percent: Math.round(s.score * 100),
        barFraction: leader > 0 ? s.score / leader : 0,
        accent: accentHex(tribe.color),
        isPrimary: s.slug === primary.slug,
        isSecondary: secondary ? s.slug === secondary.slug : false,
      };
    }),
  };
}

/**
 * Maps a tribe's Tailwind color name to its accent hex. Mirrors the `accentHex`
 * lookups in `page.tsx` and the tribe detail page (CLAUDE.md notes the
 * duplication); a missing key falls back to brass, as elsewhere.
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
