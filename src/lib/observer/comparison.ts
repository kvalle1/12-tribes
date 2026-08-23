import type { TribeScore } from "@/lib/assessment/score";

/**
 * Pure self-vs-others comparison for the 360 report (issue #9). Given the
 * Subject's own profile and the equal-weight aggregated "others" profile, it
 * pairs them tribe-by-tribe and partitions the tribes into where the two
 * readings *align* and where they *diverge*.
 *
 * Kept dependency-free (only the `TribeScore` type, erased at build) and out of
 * the view so the partition rules — the "the gap is where growth lives" heart of
 * the report (ADR-0003) — are unit-testable and can never contradict
 * themselves: alignment and divergence are two sides of one closeness band on a
 * shared scale, so no tribe can land in both.
 */

/** Scores at or below this are treated as "not read" (absent). */
export const PRESENCE_EPSILON = 1e-6;

/**
 * A tribe counts as *aligned* only when the two readings differ by no more than
 * this fraction of the shared display scale; anything beyond it *diverges*. One
 * threshold splits the two lists so they stay mutually exclusive.
 */
export const ALIGN_GAP_FRACTION = 0.2;

export interface CompareRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" score for this tribe. */
  others: number;
  /** self − others: positive ⇒ you read it stronger; negative ⇒ others do. */
  gap: number;
}

export interface ProfileComparison {
  /** All tribes paired, strongest reading first (max of self/others). */
  rows: CompareRow[];
  /** The shared max score both series' bars are drawn against. */
  scale: number;
  /**
   * Up to two tribes both you and your observers read, and read about equally —
   * genuine agreement, not agreement on a tribe nobody sees.
   */
  alignments: CompareRow[];
  /** Up to three tribes whose two readings differ the most. */
  divergences: CompareRow[];
}

export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));

  const rows: CompareRow[] = self
    .map((s) => {
      const o = othersBySlug.get(s.slug) ?? 0;
      return { slug: s.slug, name: s.name, self: s.score, others: o, gap: s.score - o };
    })
    // Strongest reading first (whichever of self/others is higher).
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  const scale = Math.max(
    PRESENCE_EPSILON,
    ...rows.flatMap((r) => [r.self, r.others]),
  );
  const closeGap = ALIGN_GAP_FRACTION * scale;

  // A tribe qualifies for a highlight only when someone actually read it.
  const present = rows.filter(
    (r) => r.self > PRESENCE_EPSILON || r.others > PRESENCE_EPSILON,
  );

  const alignments = present
    // Both sides read it (agreeing on an absent tribe isn't insight) AND close.
    .filter(
      (r) =>
        Math.min(r.self, r.others) > PRESENCE_EPSILON &&
        Math.abs(r.gap) <= closeGap,
    )
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
    .slice(0, 2);

  const divergences = present
    .filter((r) => Math.abs(r.gap) > closeGap)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return { rows, scale, alignments, divergences };
}
