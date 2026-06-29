import "server-only";
import { tribes, type Tribe } from "@/lib/tribes";
import { score } from "./score";
import { resolveHeadline } from "./result";

/**
 * Builds the enriched result view (issue #6) from a saved result row: the full
 * 12-tribe ranking, the Subject's selected words, and which tribes are the
 * Primary/Secondary. The ranking is recomputed from the saved `words` by the
 * pure scoring core, so the bars can never drift from the stored result and the
 * view renders identically whether shown right after submitting or when a Subject
 * revisits their saved current result.
 *
 * This module pulls in the word→tribe mapping (via `score`), so it is
 * `server-only` to keep that mapping off the client (ADR-0009 trust boundary).
 * The presentational component receives only the already-computed view.
 */

export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score for this tribe (ADR-0001). */
  score: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

export interface ResultView {
  primary: Tribe;
  secondary?: Tribe;
  /** The Subject's selected words, in selection order. */
  words: string[];
  /** All 12 tribes, sorted by score descending (canonical order breaks ties). */
  ranked: RankedTribe[];
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export interface SavedResult {
  words: string[];
  primarySlug: string;
  secondarySlug?: string | null;
}

export function buildResultView(row: SavedResult): ResultView {
  const { primary, secondary } = resolveHeadline(
    row.primarySlug,
    row.secondarySlug,
  );

  // `score` returns one entry per tribe in canonical (tribe `number`) order.
  // A stable sort by score keeps that canonical order on ties, so the top of the
  // ranking matches `deriveResult`'s Primary exactly.
  const ranked: RankedTribe[] = score(row.words)
    .map((s) => {
      const tribe = tribeBySlug.get(s.slug);
      if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
      return {
        tribe,
        score: s.score,
        isPrimary: s.slug === primary.slug,
        isSecondary: secondary ? s.slug === secondary.slug : false,
      };
    })
    .sort((a, b) => b.score - a.score);

  return { primary, secondary, words: row.words, ranked };
}
