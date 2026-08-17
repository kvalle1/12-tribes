import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). Each Observer's words are scored individually by the same pure
 * core the Self flow uses (`score`), producing a normalized 0–1 profile, and the
 * "others" profile is the **equal-weight average** of those per-observer
 * profiles — one observer who selects more words does not gain more influence,
 * because every observer is scored and normalized first, then weighted 1/N.
 * This is deliberately *not* a pooled bag of words (which would let word count
 * become influence).
 *
 * The module reuses the `server-only` scoring core, so it is server-only too;
 * the word→tribe mapping never reaches the client (ADR-0009).
 */

/**
 * The report unlocks only once at least this many Observers have responded — it
 * makes the average meaningful and preserves anonymity at the individual level
 * (ADR-0003). Below the floor the Subject sees a locked state, not a report.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

export interface ObserverAggregate {
  /** How many Observer responses were averaged. */
  observerCount: number;
  /**
   * The equal-weight average normalized score per tribe, in canonical (tribe
   * `number`) order — the "how others see you" profile.
   */
  scores: TribeScore[];
  /**
   * Each Observer's individual normalized profile, in the order the responses
   * were given. Backs the anonymous per-observer drill-down (Observer 1/2/3);
   * carries no observer identity, only their scored words.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile. Each entry in `responses` is one Observer's selected words. Returns
 * all-zero scores and a zero count for an empty input, so callers can render a
 * locked state without special-casing.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  // `score` returns tribes in canonical order, so position `i` is `tribes[i]`
  // in every per-observer profile — average across observers position by
  // position.
  const scores: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce(
      (sum, observer) => sum + observer[i].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, scores, perObserver };
}

/**
 * Whether enough Observers have responded to unlock the comparison report
 * (ADR-0003). Applied server-side to decide between the locked state and the
 * full report.
 */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS_FOR_REPORT;
}
