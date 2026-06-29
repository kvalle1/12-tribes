import type { TribeScore } from "./score";

/**
 * Pure presentation helper for the result page's 12-tribe ranking bars (issue
 * #6). Given the scoring core's per-tribe scores plus the derived Primary (and
 * optional Secondary) slugs, it returns a display-ready, high→low ranked list:
 * each row carries the normalized score, a rounded percentage, the bar width
 * relative to the leader, and Primary/Secondary flags for accenting.
 *
 * Kept separate from `score.ts` (which owns the math) and from the React view
 * (which owns the markup) so the ordering / bar-scaling logic is unit-testable
 * without a DB or the DOM.
 */
export interface RankedTribe {
  slug: string;
  name: string;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** `score` as a rounded 0–100 percentage, for the row label. */
  percent: number;
  /** Bar width as a 0–1 fraction of the leader's score, so the top bar is full. */
  barFraction: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

/**
 * Rank tribe scores for display. Sorts by score descending; ties keep the input
 * order, which is the scoring core's canonical (tribe `number`) order, so the
 * result is deterministic. Bars scale relative to the highest score — the
 * leader fills the track and the rest are proportional — which keeps the chart
 * legible whatever the absolute normalized values are. An all-zero profile
 * yields zero-width bars rather than a divide-by-zero.
 */
export function rankTribes(
  scores: readonly TribeScore[],
  primarySlug: string,
  secondarySlug?: string | null,
): RankedTribe[] {
  const max = scores.reduce((m, s) => Math.max(m, s.score), 0);
  const ranked = [...scores].sort((a, b) => b.score - a.score);

  return ranked.map((s) => ({
    slug: s.slug,
    name: s.name,
    score: s.score,
    percent: Math.round(s.score * 100),
    barFraction: max > 0 ? s.score / max : 0,
    isPrimary: s.slug === primarySlug,
    isSecondary: !!secondarySlug && s.slug === secondarySlug,
  }));
}
