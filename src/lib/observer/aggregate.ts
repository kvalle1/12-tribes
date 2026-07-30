import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the equal-weight average of each
 * Observer's *individually-normalized* tribe scores — not a pooled bag of words.
 * Each Observer's selection is scored on its own through the same scoring core
 * the Self flow uses, then the per-tribe scores are averaged with weight 1/N. An
 * Observer who selects more words therefore gains no extra influence: their
 * normalized profile still counts exactly once.
 *
 * `server-only` because it pulls in the scoring core (and through it the
 * word→tribe mapping), which must never reach the client (ADR-0009). It is still
 * unit-testable: Vitest aliases `server-only` to a stub (see `vitest.config.ts`).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — enough for the average to be meaningful and for individual
 * Observers to stay anonymous in aggregate (ADR-0003).
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether the comparison report is unlocked for a Subject with `count` responses. */
export function isReportUnlocked(count: number): boolean {
  return count >= MIN_OBSERVERS_FOR_REPORT;
}

export interface ObserverAggregate {
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the element-wise mean of every Observer's
   * normalized scores, in canonical (tribe `number`) order. All-zero when there
   * are no responses.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized scores, in the same order the responses were
   * given (so "Observer 1/2/3" drill-down labels stay stable) and fully
   * anonymous — a row carries scores only, never who submitted it.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the per-observer breakdown. Each response is a list of selected
 * words; scoring handles unknown words and duplicates. The input is not mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe, tribeIndex) => {
    const sum = perObserver.reduce(
      (acc, observerScores) => acc + observerScores[tribeIndex].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });

  return { observerCount, others, perObserver };
}

export interface TribeComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /** Signed gap `others − self`: positive = others see it more than you do. */
  divergence: number;
}

/**
 * Pair a Subject's self profile against the aggregated "others" profile per
 * tribe, in canonical order, attaching the signed divergence. Both inputs are
 * normalized `TribeScore[]` on the same 0–1 scale, so the gap is directly
 * comparable. Matched by slug so the two orderings need not coincide.
 */
export function compareSelfToOthers(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): TribeComparison[] {
  const selfBySlug = new Map(self.map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  return tribes.map((tribe) => {
    const selfScore = selfBySlug.get(tribe.slug) ?? 0;
    const othersScore = othersBySlug.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      self: selfScore,
      others: othersScore,
      divergence: othersScore - selfScore,
    };
  });
}

export interface ComparisonSummary {
  /** The Subject's highest-scoring tribe. */
  topSelf: TribeComparison;
  /** The Observers' highest-scoring tribe. */
  topOthers: TribeComparison;
  /** True when both sides lead with the same tribe — the headline agreement. */
  aligned: boolean;
  /** The tribe with the largest absolute self↔others gap. */
  largestDivergence: TribeComparison;
}

/**
 * Distil the per-tribe comparison into a short, honest headline: each side's
 * leading tribe, whether they agree, and where the biggest gap sits. Ties keep
 * canonical order (the first tribe reached wins), matching the deterministic
 * ordering the rest of the scoring uses. Assumes a non-empty comparison (there
 * are always 12 tribes).
 */
export function summarizeComparison(
  rows: readonly TribeComparison[],
): ComparisonSummary {
  const topSelf = rows.reduce((best, row) =>
    row.self > best.self ? row : best,
  );
  const topOthers = rows.reduce((best, row) =>
    row.others > best.others ? row : best,
  );
  const largestDivergence = rows.reduce((best, row) =>
    Math.abs(row.divergence) > Math.abs(best.divergence) ? row : best,
  );

  return {
    topSelf,
    topOthers,
    aligned: topSelf.slug === topOthers.slug,
    largestDivergence,
  };
}
