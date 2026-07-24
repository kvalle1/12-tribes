import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the equal-weight average of each
 * Observer's individually-normalized tribe scores — **not** a pooled bag of
 * words. Scoring each Observer alone (via the same `score` core the Subject
 * uses) and then averaging per tribe means an Observer who picks more words
 * gains no extra influence: every Observer contributes exactly one profile's
 * worth to the average.
 *
 * The module is pure and reuses the scoring core unchanged, so its behavior is
 * unit-testable without the DB or any I/O. Loading the anonymous rows is the
 * repository's job; deriving the comparison profile is this module's.
 */

/** Minimum Observers before the comparison report unlocks (ADR-0003). */
export const MIN_OBSERVERS = 3;

/**
 * Whether the comparison report may be shown. Below the floor the report stays
 * locked — both so the "others" average is meaningful and so no individual
 * Observer can be singled out from too small a pool (ADR-0003 anonymity).
 */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

export interface ObserverAggregate {
  /** How many Observers responded. */
  observerCount: number;
  /**
   * The equal-weight average of the per-Observer normalized scores, one entry
   * per tribe in canonical (tribe `number`) order — the "others" profile.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in the order the responses were
   * given. Anonymous by construction: the only handle on a response is its
   * index (rendered as "Observer 1/2/3"), never any identity.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate Observer word selections into the equal-weight "others" profile plus
 * the per-Observer profiles that back the anonymous drill-down. Each response is
 * scored independently with the shared core, then averaged per tribe. An empty
 * input yields a zeroed profile and no Observers.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));

  const others: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, profile) =>
        sum + (profile.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return { observerCount: perObserver.length, others, perObserver };
}
