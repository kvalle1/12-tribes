import { tribes, type Tribe } from "@/lib/tribes";
// Type-only import: erased at compile time, so this module stays client-safe
// (no runtime pull on the server-only scoring/word modules).
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

/** One ranked row in the enriched result view — a tribe, its score, and its bar. */
export interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score for this tribe. */
  score: number;
  /**
   * The normalized score as a 0–100 percentage (`score × 100`). Doubles as the
   * bar's width, so the bar a reader sees and the percentage label always agree.
   */
  widthPct: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

/**
 * The full view model for the enriched result (#6): the resolved headline tribes,
 * all 12 tribes ranked with proportional bars, and the words the Subject picked.
 * Pure and presentation-agnostic so the post-submit result page, a revisit, and
 * the profile page (#18) all render from exactly the same shape.
 */
export interface ResultView {
  primary: Tribe;
  secondary?: Tribe;
  /** All 12 tribes, ranked by score descending (ties keep canonical order). */
  ranking: RankedTribe[];
  /** The words the Subject selected, in stored order. */
  words: string[];
}

export function buildResultView(
  scores: TribeScore[],
  primarySlug: string,
  secondarySlug: string | null | undefined,
  words: readonly string[],
): ResultView {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);

  // Stable sort by score desc; `scores` arrives in canonical tribe order, so
  // ties fall back to that order — matching `deriveResult`'s tie-breaking.
  const ranked = [...scores].sort((a, b) => b.score - a.score);

  const ranking: RankedTribe[] = ranked.map((s) => {
    const tribe = tribeBySlug.get(s.slug);
    if (!tribe) throw new Error(`Unknown tribe slug "${s.slug}"`);
    return {
      tribe,
      score: s.score,
      // Normalized scores are 0–1; clamp defensively before scaling to a width.
      widthPct: Math.max(0, Math.min(1, s.score)) * 100,
      isPrimary: tribe.slug === primary.slug,
      isSecondary: secondary ? tribe.slug === secondary.slug : false,
    };
  });

  return { primary, secondary, ranking, words: [...words] };
}
