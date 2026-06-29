import { tribes, type Tribe } from "@/lib/tribes";
import { score } from "./score";

/**
 * Builds the full view-model for the enriched result view (issue #6) from a
 * stored result row: the ranked 12-tribe bars, the resolved Primary/Secondary
 * tribe objects, and the Subject's selected words.
 *
 * Scoring is recomputed from the stored words via the pure `score` core (rather
 * than persisting the 0–1 table) so the bars always reflect the current scoring
 * model. Because `score` pulls in the word→tribe mapping, this module stays on
 * the server (it is only consumed by the result page server component); the
 * mapping never reaches the client (ADR-0009 trust boundary). The same builder
 * powers the post-submit result and the revisited saved result identically.
 */

export interface TribeBar {
  tribe: Tribe;
  /** Normalized 0–1 score for this tribe (ADR-0001). */
  score: number;
  /** The normalized score as a 0–100 integer for display. */
  percent: number;
  /** Bar width as a 0–1 fraction, scaled so the top tribe fills the track. */
  fill: number;
  isPrimary: boolean;
  isSecondary: boolean;
}

export interface ResultView {
  primary: Tribe;
  secondary?: Tribe;
  /** All 12 tribes ranked by normalized score, highest first. */
  bars: TribeBar[];
  /** The words the Subject selected, in stored order. */
  words: string[];
}

export interface StoredResult {
  words: string[];
  primarySlug: string;
  secondarySlug?: string | null;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function buildResultView(row: StoredResult): ResultView {
  const primary = tribeBySlug.get(row.primarySlug);
  if (!primary) {
    throw new Error(`Unknown primary tribe slug "${row.primarySlug}"`);
  }
  const secondary = row.secondarySlug
    ? tribeBySlug.get(row.secondarySlug)
    : undefined;

  const scores = score(row.words);
  const max = scores.reduce((m, s) => Math.max(m, s.score), 0);

  const bars: TribeBar[] = scores
    .map((s) => {
      const tribe = tribeBySlug.get(s.slug)!;
      return {
        tribe,
        score: s.score,
        percent: Math.round(s.score * 100),
        fill: max > 0 ? s.score / max : 0,
        isPrimary: s.slug === row.primarySlug,
        isSecondary: secondary ? s.slug === secondary.slug : false,
      };
    })
    .sort((a, b) => b.score - a.score);

  return { primary, secondary, bars, words: row.words };
}
