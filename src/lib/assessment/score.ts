import { tribes } from "@/lib/tribes";
import { words, type WordMapping } from "@/lib/assessment/words";

/**
 * The pure scoring core of the assessment. Two functions behind a tiny
 * interface, reused unchanged by the Self flow, the profile, and (later) the
 * 360 layer:
 *
 * - {@link score} turns a set of selected Words into a normalized 0–1 score for
 *   every Tribe.
 * - {@link deriveResult} turns those scores into a Primary Tribe and an optional
 *   Secondary.
 *
 * No React, no I/O — given the same input it always returns the same output.
 */

/** A Tribe's normalized result. `score` ranges 0–1 (ADR-0001). */
export interface TribeScore {
  slug: string;
  score: number;
}

/** The headline result: always a Primary, sometimes a Secondary. */
export interface AssessmentResult {
  primary: TribeScore;
  secondary?: TribeScore;
}

/**
 * A Secondary is shown only when it scores "near" the Primary — at least this
 * fraction of the Primary's score (≈ within 20%).
 */
export const SECONDARY_MIN_RATIO_OF_PRIMARY = 0.8;

/**
 * ...and only when it is "clearly ahead" of the third Tribe — the third may be
 * no more than this fraction of the Secondary's score. When the Secondary and
 * third are ~tied, no Secondary is named.
 */
export const SECONDARY_MAX_THIRD_RATIO = 0.8;

/**
 * The weight a single Word contributes to each of its Tribes. A Word mapped to
 * exactly one Tribe contributes full weight (1.0); a Shared word splits into
 * 0.5 for each Tribe it maps to (ADR-0001).
 */
function wordWeight(mapping: WordMapping): number {
  return mapping.tribes.length > 1 ? 0.5 : 1.0;
}

/**
 * The total points available for each Tribe across the whole word list — the
 * denominator that makes scores comparable regardless of how many words map to
 * a Tribe. Computed once from the word data.
 */
const availableBySlug: Map<string, number> = (() => {
  const totals = new Map<string, number>();
  for (const tribe of tribes) totals.set(tribe.slug, 0);
  for (const mapping of words) {
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
})();

const wordsByName: Map<string, WordMapping> = new Map(
  words.map((m) => [m.word, m]),
);

/**
 * Scores a selection of Words into a normalized 0–1 value for every Tribe.
 *
 * Each Tribe's score is the points it earned from the selected Words divided by
 * the total points available for it across the whole list, so a low-coverage
 * Tribe and a high-coverage one compete fairly. Unrecognized words are ignored.
 *
 * Returns one {@link TribeScore} per Tribe, in canonical Tribe order.
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned = new Map<string, number>();
  for (const tribe of tribes) earned.set(tribe.slug, 0);

  const seen = new Set<string>();
  for (const name of selectedWords) {
    if (seen.has(name)) continue;
    seen.add(name);
    const mapping = wordsByName.get(name);
    if (!mapping) continue;
    const weight = wordWeight(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  return tribes.map((tribe) => {
    const available = availableBySlug.get(tribe.slug) ?? 0;
    const points = earned.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      score: available > 0 ? points / available : 0,
    };
  });
}

const tribeOrder = new Map(tribes.map((t, i) => [t.slug, i]));

/**
 * Derives the headline result from a set of Tribe scores.
 *
 * The Primary is always the highest-scoring Tribe (ties broken by canonical
 * Tribe order for determinism). A Secondary is named only when it scores near
 * the Primary ({@link SECONDARY_MIN_RATIO_OF_PRIMARY}) *and* is clearly ahead of
 * the third Tribe ({@link SECONDARY_MAX_THIRD_RATIO}); otherwise the result names
 * only a Primary.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  if (scores.length === 0) {
    throw new Error("deriveResult requires at least one tribe score");
  }

  const sorted = [...scores].sort(
    (a, b) =>
      b.score - a.score ||
      (tribeOrder.get(a.slug) ?? 0) - (tribeOrder.get(b.slug) ?? 0),
  );

  const [primary, second, third] = sorted;
  const result: AssessmentResult = { primary };

  const nearPrimary =
    !!second &&
    second.score > 0 &&
    second.score >= primary.score * SECONDARY_MIN_RATIO_OF_PRIMARY;
  const aheadOfThird =
    !third || third.score <= second.score * SECONDARY_MAX_THIRD_RATIO;

  if (nearPrimary && aheadOfThird) {
    result.secondary = second;
  }

  return result;
}
