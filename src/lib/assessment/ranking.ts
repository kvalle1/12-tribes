import { tribes } from "@/lib/tribes";
import type { TribeScore } from "./score";

/**
 * Presentation-ready ranking for the result page's 12-tribe bars (issue #6).
 *
 * Pure and client-safe: it takes the normalized `TribeScore[]` produced by the
 * scoring core (computed server-side from the saved words) and adds only what the
 * bars need to render — display order, a 0–100 percent for the bar width/label,
 * and each tribe's accent color name. It never touches the word→tribe mapping, so
 * that mapping stays server-side (ADR-0009 trust boundary).
 */
export interface RankedTribe {
  slug: string;
  name: string;
  /** Tailwind color name (e.g. "amber"), mapped to a hex accent at render time. */
  color: string;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** `score` expressed as a 0–100 percent — the bar's width and its numeric label. */
  percent: number;
}

const colorBySlug = new Map(tribes.map((t) => [t.slug, t.color]));

/**
 * Rank the scored tribes for display: highest score first, with ties keeping the
 * input's canonical (tribe `number`) order so the ranking is deterministic. All
 * 12 tribes are always returned — including those that scored 0 — so the Subject
 * sees the full picture behind their result.
 */
export function rankForDisplay(scores: readonly TribeScore[]): RankedTribe[] {
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      color: colorBySlug.get(s.slug) ?? "",
      score: s.score,
      percent: s.score * 100,
    }));
}
