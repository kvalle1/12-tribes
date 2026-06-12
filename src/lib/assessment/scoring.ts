import { tribes } from "../tribes";
import { words, type AssessmentWord } from "./words";

/** A normalized score (0–1) for each tribe, keyed by tribe slug. */
export type TribeScores = Record<string, number>;

/** The outcome of an assessment: a Primary tribe and an optional Secondary. */
export interface AssessmentResult {
  /** Slug of the highest-scoring tribe. Always present. */
  primary: string;
  /** Slug of the Secondary tribe, or null when none qualifies. */
  secondary: string | null;
}

/**
 * A Secondary qualifies only when it scores within 20% of the Primary, so it
 * must reach at least this fraction of the Primary's score.
 */
const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;
/**
 * ...and only when it is clearly ahead of the third tribe, so the third must
 * sit at or below this fraction of the Secondary's score.
 */
const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** The point each tribe earns from a single selection of `word`. */
function shareFor(word: AssessmentWord): number {
  return 1 / word.tribes.length;
}

/** Total points available to each tribe across the whole word list. */
function availablePoints(): TribeScores {
  const available: TribeScores = {};
  for (const tribe of tribes) available[tribe.slug] = 0;
  for (const entry of words) {
    const share = shareFor(entry);
    for (const slug of entry.tribes) available[slug] += share;
  }
  return available;
}

/**
 * Score a set of selected words into a normalized 0–1 value per tribe
 * (ADR-0001). A tribe's score is the points earned from the selection divided
 * by the points available to that tribe across the whole list, so a tribe with
 * few words competes fairly with a tribe that has many. A shared word
 * contributes an equal fraction (1/N) to each of its N tribes — 0.5 each for a
 * two-tribe word. Unknown and duplicate words are ignored.
 */
export function score(selectedWords: string[]): TribeScores {
  const available = availablePoints();
  const selected = new Set(selectedWords);

  const earned: TribeScores = {};
  for (const tribe of tribes) earned[tribe.slug] = 0;
  for (const entry of words) {
    if (!selected.has(entry.word)) continue;
    const share = shareFor(entry);
    for (const slug of entry.tribes) earned[slug] += share;
  }

  const scores: TribeScores = {};
  for (const tribe of tribes) {
    const denom = available[tribe.slug];
    scores[tribe.slug] = denom === 0 ? 0 : earned[tribe.slug] / denom;
  }
  return scores;
}

/**
 * Derive the Primary (and optional Secondary) tribe from a score map. The
 * Primary is always the top score. A Secondary is returned only when it is near
 * the Primary (within 20%) and clearly ahead of the third tribe — otherwise the
 * result is Primary-only.
 */
export function deriveResult(scores: TribeScores): AssessmentResult {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  const [primarySlug, primaryScore] = ranked[0];
  const secondary = ranked[1];
  const thirdScore = ranked[2]?.[1] ?? 0;

  const qualifies =
    secondary !== undefined &&
    secondary[1] > 0 &&
    secondary[1] >= SECONDARY_NEAR_PRIMARY_RATIO * primaryScore &&
    thirdScore <= SECONDARY_AHEAD_OF_THIRD_RATIO * secondary[1];

  return {
    primary: primarySlug,
    secondary: qualifies ? secondary[0] : null,
  };
}
