import type { TribeScore } from "./score";

/**
 * Presentation shaping for the result page's 12-tribe ranking bars (issue #6).
 *
 * Pure and free of any server-only coupling (it takes already-computed
 * `TribeScore`s as a type-only input), so it is unit-testable on its own and
 * safe to run wherever the bars are rendered. Scoring itself stays server-side
 * in `score.ts`; this module only orders the results and works out bar widths.
 */
export interface RankedTribeBar {
  slug: string;
  name: string;
  /** The underlying normalized 0–1 score. */
  score: number;
  /** The normalized score as a rounded 0–100 percentage — the label shown. */
  scorePct: number;
  /**
   * Bar width as a 0–100 percentage of the track, scaled relative to the
   * top-scoring tribe so the leader fills the track and the rest are read in
   * proportion to it. 0 for every tribe when nothing scored.
   */
  barPct: number;
}

/**
 * Rank a full set of tribe scores highest-first and attach the percentage label
 * and proportional bar width each row renders. A stable sort keeps canonical
 * (tribe `number`) order for ties, matching `deriveResult` so the Primary always
 * leads its equals.
 */
export function rankTribeBars(
  scores: readonly TribeScore[],
): RankedTribeBar[] {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;

  return ranked.map((s) => ({
    slug: s.slug,
    name: s.name,
    score: s.score,
    scorePct: Math.round(s.score * 100),
    barPct: max > 0 ? (s.score / max) * 100 : 0,
  }));
}
