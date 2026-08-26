import type { TribeScore } from "./score";

/**
 * Pure, client-safe helpers that turn a Subject's Self profile and the
 * aggregated "others" profile into the rows the comparison report renders (issue
 * #9). Like `ranking.ts`, this imports only the `TribeScore` *type* from the
 * `server-only` scoring core — a type-only import is erased at build time, so
 * nothing server-only reaches the client and the report view can import these
 * directly.
 */

export interface ComparisonRow extends TribeScore {
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight aggregated "others" score for this tribe. */
  others: number;
  /** `others - self`: positive where others see the tribe more strongly. */
  delta: number;
}

/**
 * Join a Self profile and an "others" profile by tribe slug into comparison rows
 * ordered by the Subject's own score, highest first. Both inputs are normalized
 * 0–1 profiles in canonical order (from `score` / `aggregateObservers`); the
 * canonical order is preserved as the tie-break because the sort is stable. The
 * `name`/`slug` come from the Self profile. `delta` is `others - self`, so a
 * positive value marks a tribe others read more strongly than the Subject does.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const rows: ComparisonRow[] = self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      score: s.score,
      self: s.score,
      others: othersScore,
      delta: othersScore - s.score,
    };
  });

  return rows.sort((a, b) => b.self - a.self);
}

/**
 * The tribes where Self and others diverge most, largest gap first — "the gap is
 * where growth lives" (ADR-0003). Ties keep the input order (a stable sort over
 * the self-ranked rows), and only tribes with a non-zero gap are returned, so a
 * perfectly-aligned read yields an empty list rather than noise.
 */
export function topDivergences(
  rows: readonly ComparisonRow[],
  limit = 3,
): ComparisonRow[] {
  return [...rows]
    .filter((r) => r.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}
