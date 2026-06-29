import "server-only";
import { tribes, type Tribe } from "@/lib/tribes";
import { resolveHeadline } from "./result";
import { score } from "./score";

/**
 * Pure builder for the enriched result view (#6). It re-scores the Subject's
 * saved words to produce the 12-tribe ranking and pairs it with the stored
 * Primary/Secondary so the bars, the headline, and the saved row never drift.
 *
 * It is `server-only` because `score` pulls in the word→tribe mapping, which
 * must not reach the client (ADR-0009). Both the post-submit result page and the
 * profile page (#18) feed it the same stored row, so they render identically.
 */
const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score for this tribe. */
  score: number;
  /** Bar width 0–100, scaled so the top-scoring tribe fills the bar. */
  barPct: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

export interface ResultView {
  primary: Tribe;
  secondary?: Tribe;
  /** All 12 tribes, sorted by descending score (ties keep canonical order). */
  ranked: RankedTribe[];
  /** The Subject's selected words, for display. */
  words: string[];
}

export function buildResultView(input: {
  words: readonly string[];
  primarySlug: string;
  secondarySlug?: string | null;
}): ResultView {
  // Resolve (and validate) the stored Primary/Secondary the same way the
  // headline does, so a bad slug fails loudly rather than rendering wrong.
  const { primary, secondary } = resolveHeadline(
    input.primarySlug,
    input.secondarySlug,
  );

  // The `isPrimary`/`isSecondary` flags below match the *stored* slugs against
  // the freshly recomputed ranking. This relies on the invariant that the
  // stored Primary/Secondary were derived from these same words by
  // `score`/`deriveResult` (see `saveCurrentResult`). If those thresholds ever
  // change, stored rows must be re-derived (migrated) or the flags could land
  // on a row that is no longer the top two under the new rules.

  const scores = score(input.words);
  const maxScore = scores.reduce((m, s) => Math.max(m, s.score), 0);

  // Stable sort: equal scores keep `score`'s canonical (tribe number) order.
  const ranked: RankedTribe[] = [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s) => ({
      tribe: tribeBySlug.get(s.slug)!,
      score: s.score,
      barPct: maxScore > 0 ? (s.score / maxScore) * 100 : 0,
      isPrimary: s.slug === primary.slug,
      isSecondary: secondary ? s.slug === secondary.slug : false,
    }));

  return { primary, secondary, ranked, words: [...input.words] };
}
