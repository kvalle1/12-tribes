import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure presentation helpers for the 360 comparison report (issue #9): join a
 * Subject's own Strength Profile against the equal-weight "others" profile and
 * surface where the two agree and where they diverge — "the gap is where growth
 * lives" (ADR-0003).
 *
 * Client-safe: it operates only on already-computed normalized scores (plain
 * numbers), never the word→tribe mapping, so the comparison view can import it
 * without crossing the ADR-0009 trust boundary.
 */

export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /** `others - self`: positive when others see more of this tribe than the Subject does. */
  delta: number;
  /** Self bar-fill fraction on a scale shared with `others`, so the two bars are comparable. */
  selfRelative: number;
  /** Others bar-fill fraction on the same shared scale. */
  othersRelative: number;
}

/**
 * A tribe counts as a notable divergence when self and others differ by at least
 * this much (on the normalized 0–1 scale) — small gaps are noise, not signal.
 */
export const DIVERGENCE_THRESHOLD = 0.1;

/**
 * Join the self and others profiles into comparison rows, highest-prominence
 * tribe first. Prominence is the larger of the two scores, so a tribe rises to
 * the top whether the Subject or the Observers see it strongly. Ties keep the
 * input's canonical (tribe `number`) order. Bar-fill fractions are scaled to a
 * max shared across both profiles so the self and others bars read on one scale.
 *
 * Both inputs are expected in canonical order and over the same 12 tribes (as
 * `score` / `aggregateObservers` produce); rows are matched by slug.
 */
export function buildComparison(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((t) => [t.slug, t.score]));

  const max = Math.max(
    0,
    ...self.map((t) => t.score),
    ...others.map((t) => t.score),
  );

  const rows: ComparisonRow[] = self.map((t) => {
    const othersScore = othersBySlug.get(t.slug) ?? 0;
    return {
      slug: t.slug,
      name: t.name,
      self: t.score,
      others: othersScore,
      delta: othersScore - t.score,
      selfRelative: max > 0 ? t.score / max : 0,
      othersRelative: max > 0 ? othersScore / max : 0,
    };
  });

  // Stable sort by prominence desc; equal prominence keeps canonical order.
  return rows.sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );
}

/**
 * The rows where self and others diverge by at least `DIVERGENCE_THRESHOLD`,
 * largest gap first — the "blind spots" and "hidden strengths" the report
 * highlights. Ties in gap size keep the input order.
 */
export function notableDivergences(
  rows: readonly ComparisonRow[],
): ComparisonRow[] {
  return rows
    .filter((r) => Math.abs(r.delta) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
