import { tribes, type Tribe } from "@/lib/tribes";
import { resolveHeadline, type ResultHeadline } from "./result";
import { score } from "./score";

/**
 * View-model for the enriched result view (issue #6): the headline tribes, the
 * full 12-tribe ranking, and the words the Subject picked. Built purely from a
 * saved result's `words` + stored slugs so the post-submit result page and the
 * profile page (#18) render the exact same thing from the same data.
 *
 * This module imports the scoring core (and through it the word→tribe mapping),
 * so it is server-intended — call it from a Server Component and pass the plain
 * `RankedTribeScore` rows to the presentational view. It deliberately does NOT
 * carry the mapping itself, so the mapping never reaches the client (ADR-0009).
 */

export interface RankedTribeScore {
  slug: string;
  name: string;
  /** Tailwind color name (e.g. "amber") used for the per-tribe accent. */
  color: string;
  /** Normalized 0–1 score (points earned ÷ points available for the tribe). */
  score: number;
  /**
   * Bar width relative to the top-scoring tribe (0–1): the leader fills the
   * track and the rest are proportional to it. 0 when nothing was selected.
   */
  fraction: number;
}

export interface ResultViewModel extends ResultHeadline {
  /** All 12 tribes ranked by normalized score, descending. */
  ranking: RankedTribeScore[];
  /** The words the Subject selected, in their stored order. */
  words: string[];
}

const tribeBySlug = new Map<string, Tribe>(tribes.map((t) => [t.slug, t]));

/**
 * Build the full result view-model from a saved result. `score()` is normalized
 * and canonical-order; we rank it descending (ties keep canonical order, matching
 * `deriveResult`) and scale each bar against the leader. The headline tribes come
 * from the stored slugs so the named Primary/Secondary always agree with what was
 * persisted, even if scoring thresholds are later retuned.
 */
export function buildResultView(
  words: readonly string[],
  primarySlug: string,
  secondarySlug?: string | null,
): ResultViewModel {
  const headline = resolveHeadline(primarySlug, secondarySlug);

  const ranked = [...score(words)].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;

  const ranking: RankedTribeScore[] = ranked.map((s) => ({
    slug: s.slug,
    name: s.name,
    color: tribeBySlug.get(s.slug)?.color ?? "",
    score: s.score,
    fraction: top > 0 ? s.score / top : 0,
  }));

  return { ...headline, ranking, words: [...words] };
}
