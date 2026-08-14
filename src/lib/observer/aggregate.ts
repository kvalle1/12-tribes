import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * The pure "others" aggregation for the 360 comparison report (issue #9,
 * ADR-0003). Given the anonymous Observer responses for a Subject, it scores
 * each Observer **individually** with the shared scoring core and returns the
 * **equal-weight average** of those per-Observer normalized profiles.
 *
 * Equal-weight is the whole point: because each Observer is normalized to a 0–1
 * profile *before* averaging, an Observer who picks more words does not gain
 * more influence over the result. This is deliberately **not** a pooled bag of
 * words (which would let a wordier Observer dominate) — it is the mean of the
 * individual normalized profiles.
 *
 * The module is pure and dependency-free (beyond the scoring core it reuses
 * unchanged), so its external behavior is unit-testable without the DB. It is
 * `server-only` because it reuses the `server-only` scoring core — the
 * word→tribe mapping never reaches the client (ADR-0009). The report page
 * computes with it on the server and passes only the resulting per-tribe numbers
 * to the client.
 */

/** One Observer's submission — just the words they picked; never any identity. */
export interface ObserverResponseInput {
  readonly words: readonly string[];
}

export interface AggregatedObserverProfile {
  /** How many Observer responses contributed (the report unlocks at ≥3). */
  observerCount: number;
  /**
   * The equal-weight "others" profile: for each tribe, the mean of the
   * Observers' individually-normalized scores, in canonical (tribe `number`)
   * order. All-zero when there are no responses.
   */
  scores: TribeScore[];
  /**
   * Each Observer's own individually-normalized profile, in the order the
   * responses were given. Anonymous — the index is the only handle (Observer 1,
   * 2, 3…), carrying no attribute that could identify who responded. Backs the
   * per-observer drill-down.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate anonymous Observer responses into the equal-weight "others" profile
 * plus each Observer's individual profile for drill-down. See the module note
 * for the equal-weight rationale.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseInput[],
): AggregatedObserverProfile {
  const perObserver = responses.map((response) => score(response.words));
  const count = perObserver.length;

  const scores: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, observer) =>
        sum + (observer.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });

  return { observerCount: count, scores, perObserver };
}
