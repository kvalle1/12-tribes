import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure, client-safe support for the 360 comparison report (issue #9). Takes two
 * already-computed profiles — the Subject's own `score()` result and the
 * equal-weight "others" profile from `aggregateObservers` — and merges them into
 * per-tribe rows the report renders as side-by-side bars, surfacing where the
 * Subject and their observers align and where they diverge.
 *
 * Deliberately free of any `server-only` import (it takes plain `TribeScore[]`,
 * never the word→tribe mapping), so the report's presentation logic is testable
 * in isolation and safe to share with client components.
 */

/**
 * The comparison report unlocks only once at least this many observers have
 * responded (ADR-0003): the average is meaningless with fewer, and the ≥3 floor
 * keeps any single observer anonymous within the aggregate.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** Whether enough observers have responded to reveal the comparison. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_TO_UNLOCK;
}

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /** `others - self`: positive = others see this tribe in you more than you do. */
  gap: number;
  /** 0–1 bar-fill for the self bar, relative to the largest score across both. */
  selfRelative: number;
  /** 0–1 bar-fill for the others bar, relative to the largest score across both. */
  othersRelative: number;
}

/**
 * Merge the self and others profiles into per-tribe comparison rows, ranked by
 * combined prominence (`self + others`) so the tribes that matter to either view
 * rise to the top. Bar fractions are scaled to the single largest score across
 * both profiles, so the two bars are directly comparable and the chart stays
 * readable even when all normalized scores are small (mirrors `rankScores`).
 * Ranking ties keep canonical (tribe `number`) order for determinism. Neither
 * input is mutated; both are expected in canonical order (as `score` and
 * `aggregateObservers` return them).
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));

  const merged = self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersScore,
      gap: othersScore - s.score,
    };
  });

  const max = merged.reduce(
    (m, r) => Math.max(m, r.self, r.others),
    0,
  );

  return merged
    .sort((a, b) => b.self + b.others - (a.self + a.others))
    .map((r) => ({
      ...r,
      selfRelative: max > 0 ? r.self / max : 0,
      othersRelative: max > 0 ? r.others / max : 0,
    }));
}
