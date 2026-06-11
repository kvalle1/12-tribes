import { tribes } from "../tribes";
import { WORD_MAPPINGS, type WordMapping } from "./words";

/**
 * Normalized scoring core for the Self Assessment (ADR-0001).
 *
 * A word carries a single point split evenly across the tribe(s) it maps to —
 * so a word mapped to one tribe gives it 1.0, a two-tribe word gives 0.5 to
 * each, and the lone three-tribe word ("Zealous") gives 1/3 to each.
 *
 * A tribe's score is **normalized**: the points it earned from the selected
 * words divided by the total points available to it across the whole word
 * list. That yields a 0–1 value comparable across tribes regardless of how
 * many words happen to map to each — a 6-word tribe and a 10-word tribe can
 * both reach 1.0.
 */
export interface TribeScore {
  slug: string;
  /** Normalized 0–1 score. */
  score: number;
}

/**
 * How near the Secondary must be to the Primary to be shown — the Secondary
 * may sit at most this fraction below the Primary (≈ "within 20%"). Tunable.
 */
export const SECONDARY_WITHIN_PRIMARY = 0.2;

/**
 * How clearly the Secondary must lead the third tribe to be shown — the third
 * tribe must sit at least this fraction below the Secondary. Tunable.
 */
export const THIRD_BEHIND_SECONDARY = 0.2;

/** The point weight a single word contributes to each of its tribes. */
function weightOf(mapping: WordMapping): number {
  return 1 / mapping.tribes.length;
}

/** slug -> 1-based tribe number, for deterministic tie-breaking. */
const tribeOrder = new Map(tribes.map((t) => [t.slug, t.number]));

/**
 * The total points available to each tribe across the entire word list — the
 * denominator of the normalization. Derived from the word data, so it tracks
 * the mapping automatically.
 */
export function availablePoints(): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const t of tribes) totals[t.slug] = 0;
  for (const mapping of WORD_MAPPINGS) {
    const w = weightOf(mapping);
    for (const slug of mapping.tribes) {
      totals[slug] = (totals[slug] ?? 0) + w;
    }
  }
  return totals;
}

/**
 * The raw (un-normalized) points each tribe earns from a selection — the
 * numerator. Exposed so the per-word 0.5/1.0 split is directly verifiable.
 * Unknown words are ignored.
 */
export function rawPoints(selectedWords: string[]): Record<string, number> {
  const selected = new Set(selectedWords);
  const earned: Record<string, number> = {};
  for (const t of tribes) earned[t.slug] = 0;
  for (const mapping of WORD_MAPPINGS) {
    if (!selected.has(mapping.word)) continue;
    const w = weightOf(mapping);
    for (const slug of mapping.tribes) {
      earned[slug] = (earned[slug] ?? 0) + w;
    }
  }
  return earned;
}

/**
 * Score a selection of words, returning a normalized 0–1 value for every
 * tribe, ranked highest first (ties broken by tribe number for determinism).
 */
export function score(selectedWords: string[]): TribeScore[] {
  const earned = rawPoints(selectedWords);
  const available = availablePoints();

  return tribes
    .map((t) => {
      const denom = available[t.slug];
      return {
        slug: t.slug,
        score: denom > 0 ? earned[t.slug] / denom : 0,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (tribeOrder.get(a.slug) ?? 0) - (tribeOrder.get(b.slug) ?? 0),
    );
}

export interface AssessmentResult {
  /** Always present — the highest-scoring tribe (slug). */
  primary: string;
  /** Present only when a tribe genuinely qualifies as a runner-up. */
  secondary?: string;
}

/**
 * Derive the Primary (and optional Secondary) tribe from a set of scores.
 *
 * Primary is always the highest score. A Secondary is named only when it is
 * near the Primary (within `SECONDARY_WITHIN_PRIMARY`) **and** clearly ahead
 * of the third tribe (at least `THIRD_BEHIND_SECONDARY` ahead) — otherwise the
 * result is an honest Primary-only.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort(
    (a, b) =>
      b.score - a.score ||
      (tribeOrder.get(a.slug) ?? 0) - (tribeOrder.get(b.slug) ?? 0),
  );

  const [primary, second, third] = ranked;
  const result: AssessmentResult = { primary: primary.slug };

  if (!second || primary.score <= 0) return result;

  const nearPrimary =
    (primary.score - second.score) / primary.score <= SECONDARY_WITHIN_PRIMARY;
  if (!nearPrimary) return result;

  // nearPrimary guarantees second.score > 0, so the division below is safe.
  const aheadOfThird =
    !third ||
    (second.score - third.score) / second.score >= THIRD_BEHIND_SECONDARY;
  if (aheadOfThird) result.secondary = second.slug;

  return result;
}
