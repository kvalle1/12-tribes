import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";

/** Normalized score (0–1) per tribe, keyed by tribe slug. Always all 12 tribes. */
export type TribeScores = Record<string, number>;

/** The outcome of an assessment: a Primary tribe and an optional Secondary. */
export interface AssessmentResult {
  primary: string;
  secondary?: string;
}

/**
 * A Secondary must score at least this fraction of the Primary to count as
 * "near" it (≈ within 20%, per the assessment design).
 */
const SECONDARY_NEAR_PRIMARY_RATIO = 0.8;

/**
 * A Secondary must be clearly ahead of the third tribe to count: the third
 * tribe may be at most this fraction of the Secondary. Otherwise the two are
 * "~tied" and reporting a Secondary would be misleading.
 */
const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8;

/** Per-word weight: a sole-tribe word is worth 1, a shared word 0.5 to each. */
function weightOf(tribeCount: number): number {
  return tribeCount === 1 ? 1 : 0.5;
}

/**
 * Total points available for each tribe across the whole word list — the
 * denominator that normalizes scores so uneven coverage doesn't favor
 * high-coverage tribes (ADR-0001). Computed once from the static word data.
 */
const availablePoints: TribeScores = (() => {
  const totals: TribeScores = {};
  for (const t of tribes) totals[t.slug] = 0;
  for (const { tribes: mapped } of WORDS) {
    const w = weightOf(mapped.length);
    for (const slug of mapped) totals[slug] += w;
  }
  return totals;
})();

/**
 * Scores a set of selected words into a normalized 0–1 value per tribe.
 *
 * Each selected word adds its per-tribe weight (1 for a sole word, 0.5 for a
 * shared word) to every tribe it maps to. The earned total is then divided by
 * that tribe's available points so every tribe competes on the same scale,
 * regardless of how many words map to it.
 *
 * Unknown words are ignored and duplicate selections count once.
 */
export function score(selectedWords: string[]): TribeScores {
  const selected = new Set(selectedWords);
  const earned: TribeScores = {};
  for (const t of tribes) earned[t.slug] = 0;

  for (const { word, tribes: mapped } of WORDS) {
    if (!selected.has(word)) continue;
    const w = weightOf(mapped.length);
    for (const slug of mapped) earned[slug] += w;
  }

  const scores: TribeScores = {};
  for (const t of tribes) {
    const avail = availablePoints[t.slug];
    scores[t.slug] = avail > 0 ? earned[t.slug] / avail : 0;
  }
  return scores;
}

/**
 * Derives the Primary (and optional Secondary) tribe from a score record.
 *
 * The Primary is always the highest-scoring tribe (ties broken by tribe number
 * for determinism). A Secondary is returned only when it is near the Primary
 * (≈ within 20%) AND clearly ahead of the third tribe — otherwise the result is
 * Primary-only.
 */
export function deriveResult(scores: TribeScores): AssessmentResult {
  const order = new Map(tribes.map((t) => [t.slug, t.number]));
  const ranked = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0);
  });

  const [primarySlug, primaryScore] = ranked[0];
  const result: AssessmentResult = { primary: primarySlug };

  const second = ranked[1];
  const third = ranked[2];
  if (second && primaryScore > 0) {
    const [secondSlug, secondScore] = second;
    const thirdScore = third ? third[1] : 0;
    const nearPrimary = secondScore >= SECONDARY_NEAR_PRIMARY_RATIO * primaryScore;
    const aheadOfThird = thirdScore <= SECONDARY_AHEAD_OF_THIRD_RATIO * secondScore;
    if (nearPrimary && aheadOfThird) {
      result.secondary = secondSlug;
    }
  }

  return result;
}
