import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses into the "others"
 * profile (issue #9, ADR-0003).
 *
 * Each Observer response is scored on its own with the shared normalized scoring
 * core, then the per-tribe scores are averaged with **equal weight** across
 * observers — so an Observer who selects more words does not gain more
 * influence. This is deliberately different from scoring the union of everyone's
 * words (a "pooled bag of words"), where a wordier Observer would dominate.
 *
 * The module is pure and side-effect-free: it does the math for the comparison
 * report. The ≥3 unlock gate and all display scaling live with the callers. It
 * is `server-only` because it pulls in the (server-only) scoring core, keeping
 * the word→tribe mapping off the client (ADR-0009); Vitest stubs `server-only`
 * so the pure math stays unit-testable.
 */

/**
 * The minimum number of Observer responses before the comparison report
 * unlocks (ADR-0003). Below this the "others" view is neither statistically
 * meaningful nor safely anonymous at the individual level, so the report stays
 * locked.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** One Observer's individually-normalized profile, for anonymous drill-down. */
export interface ObserverProfile {
  /**
   * 1-based anonymous label index ("Observer 1", "Observer 2", …). Deliberately
   * the only thing that identifies an Observer — no name, no relationship, no
   * attribute of any kind (ADR-0003).
   */
  index: number;
  /** This Observer's own normalized 12-tribe scores, canonical (tribe order). */
  scores: TribeScore[];
}

export interface AggregatedObservers {
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /**
   * The "others" profile: the equal-weight average of each Observer's
   * individually-normalized tribe scores (ADR-0003) — NOT a pooled bag of
   * words — in canonical (tribe `number`) order.
   */
  average: TribeScore[];
  /** Each Observer's own normalized profile, for the anonymous per-observer view. */
  observers: ObserverProfile[];
}

/**
 * Aggregate anonymous Observer responses (each a list of selected words) into
 * the equal-weight "others" profile plus the per-observer profiles for
 * anonymous drill-down. Returns an all-zero average for an empty set.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): AggregatedObservers {
  const observers: ObserverProfile[] = responses.map((words, i) => ({
    index: i + 1,
    scores: score(words),
  }));

  // `score` returns one entry per tribe in canonical order, so we can average
  // position-by-position across observers.
  const average: TribeScore[] = tribes.map((tribe, t) => {
    const total = observers.reduce((sum, o) => sum + o.scores[t].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observers.length > 0 ? total / observers.length : 0,
    };
  });

  return { observerCount: observers.length, average, observers };
}
