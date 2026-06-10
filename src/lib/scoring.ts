import { tribes } from "./tribes";
import { words, isShared, type WordEntry } from "./words";

/** A normalized score in `[0, 1]` for every tribe, keyed by tribe slug. */
export type TribeScores = Record<string, number>;

export interface AssessmentResult {
  /** The best-fit tribe's slug, or `null` when no word was selected. */
  primary: string | null;
  /** The runner-up tribe's slug when it qualifies (see thresholds), else `null`. */
  secondary: string | null;
}

/**
 * A Secondary is only offered when it scores *near* the Primary — within 20%,
 * i.e. `secondary >= 0.8 * primary`.
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;

/**
 * ...and is *clearly ahead* of the third tribe — the third must sit more than
 * 20% below the Secondary, i.e. `third <= 0.8 * secondary`.
 */
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** The weight a single word contributes to one of its tribes. */
function weightFor(entry: WordEntry): number {
  return isShared(entry) ? 0.5 : 1;
}

/**
 * Total points available to each tribe across the whole word list — the
 * normalization denominator (ADR-0001). Computed once from the static data.
 */
const availablePoints: TribeScores = (() => {
  const totals: TribeScores = Object.fromEntries(
    tribes.map((t) => [t.slug, 0]),
  );
  for (const entry of words) {
    const w = weightFor(entry);
    for (const slug of entry.tribes) {
      totals[slug] += w;
    }
  }
  return totals;
})();

/**
 * Score a set of selected words into a normalized `[0, 1]` value per tribe.
 *
 * Each selected word adds its weight (0.5 if shared, else 1) to every tribe it
 * maps to; each tribe's earned points are then divided by the points available
 * to that tribe, so a 6-word tribe and a 10-word tribe compete on equal footing
 * (ADR-0001). Unknown or unselected words contribute nothing. The score for
 * every tribe is always present in the result.
 */
export function score(selectedWords: string[]): TribeScores {
  const selected = new Set(selectedWords);
  const earned: TribeScores = Object.fromEntries(
    tribes.map((t) => [t.slug, 0]),
  );

  for (const entry of words) {
    if (!selected.has(entry.word)) continue;
    const w = weightFor(entry);
    for (const slug of entry.tribes) {
      earned[slug] += w;
    }
  }

  const scores: TribeScores = {};
  for (const t of tribes) {
    const available = availablePoints[t.slug];
    scores[t.slug] = available > 0 ? earned[t.slug] / available : 0;
  }
  return scores;
}

/**
 * Derive the Primary (and optional Secondary) tribe from a score map.
 *
 * The highest-scoring tribe is the Primary; ties break by tribe `number` so the
 * result is deterministic. A Secondary is returned only when it is near the
 * Primary (`>= 0.8 * primary`) and clearly ahead of the third tribe
 * (`third <= 0.8 * secondary`). If no tribe scored above zero, there is no
 * Primary.
 */
export function deriveResult(scores: TribeScores): AssessmentResult {
  const order = new Map(tribes.map((t) => [t.slug, t.number]));
  const ranked = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0);
  });

  const [primarySlug, primaryScore] = ranked[0] ?? [null, 0];
  if (primarySlug === null || primaryScore <= 0) {
    return { primary: null, secondary: null };
  }

  const second = ranked[1];
  const third = ranked[2];
  let secondary: string | null = null;

  if (second && second[1] > 0) {
    const nearPrimary = second[1] >= SECONDARY_NEAR_PRIMARY_RATIO * primaryScore;
    const aheadOfThird =
      !third || third[1] <= SECONDARY_AHEAD_OF_THIRD_RATIO * second[1];
    if (nearPrimary && aheadOfThird) {
      secondary = second[0];
    }
  }

  return { primary: primarySlug, secondary };
}
