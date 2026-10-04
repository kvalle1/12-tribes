import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses into an "others" profile
 * (issue #9, ADR-0003).
 *
 * Each Observer's words are scored by the **same** pure scoring core the Self
 * Assessment uses (`score`), yielding a normalized 0–1 value per tribe. The
 * "others" profile is then the **equal-weight average** of those per-observer
 * vectors — every Observer contributes exactly one normalized vote per tribe,
 * regardless of how many words they picked. This is deliberately *not* a pooled
 * bag of words: pooling would let a prolific Observer who selected more words
 * dominate the aggregate, which ADR-0003 forbids.
 *
 * The module is `server-only` because it pulls in the scoring core (and through
 * it the word→tribe mapping, ADR-0009). It takes already-loaded word lists as
 * input and does no I/O, so it stays pure and unit-testable (`server-only` is
 * stubbed under Vitest, as for `score`).
 */

/** Minimum Observer responses before the comparison report unlocks (ADR-0003). */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

export interface ObserverAggregate {
  /**
   * The equal-weight average of the Observers' normalized scores, one entry per
   * tribe in canonical (tribe `number`) order — the same shape `score` returns,
   * so it drops straight into `rankScores` and the result bars.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized scores, in the order the responses were
   * given. Backs the anonymous per-observer drill-down (Observer 1/2/3…); it
   * carries scores only, never any Observer identity.
   */
  perObserver: TribeScore[][];
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
}

/**
 * Aggregate Observer word selections into the equal-weight "others" profile.
 * With no responses the average is all-zero across the twelve tribes (canonical
 * order), so callers can render a consistent shape before the report unlocks.
 * The input is never mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  // `score([])` gives the canonical twelve-tribe skeleton (all zero) even when
  // there are no observers, so the average always has the full, ordered shape.
  const average = score([]).map((tribe) => {
    const total = perObserver.reduce((sum, observer) => {
      const cell = observer.find((t) => t.slug === tribe.slug);
      return sum + (cell?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { average, perObserver, observerCount };
}

/**
 * Whether the comparison report is unlocked for a given number of Observer
 * responses. Below the threshold the "others" view stays hidden so individual
 * Observers can't be singled out (ADR-0003).
 */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}
