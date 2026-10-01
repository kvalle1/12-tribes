import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the **equal-weight average of each
 * Observer's individually-normalized tribe scores** — not a pooled bag of words.
 * Each Observer's words are scored through the same normalized scoring core the
 * Subject uses (`score`), producing a 0–1 profile per Observer; those profiles
 * are then averaged with one vote each. So an Observer who selects more words
 * does not gain more influence, and effort (word count) never becomes influence
 * (ADR-0003).
 *
 * Like the scoring core this module is `server-only` (it pulls in the
 * word→tribe mapping via `score`), so the aggregation runs server-side and the
 * mapping never reaches the client (ADR-0009 trust boundary).
 */

/** The minimum number of Observer responses before the comparison report unlocks (ADR-0003). */
export const MIN_OBSERVERS = 3;

/**
 * Whether enough Observers have responded to unlock the comparison report. Kept
 * beside `MIN_OBSERVERS` so the gate lives in one place; the report page applies
 * it and the locked state reads from the same threshold.
 */
export function hasEnoughObservers(count: number): boolean {
  return count >= MIN_OBSERVERS;
}

/** One anonymous Observer's selected words — the only thing an observer row carries. */
export interface ObserverResponseInput {
  readonly words: readonly string[];
}

export interface AggregatedObservers {
  /** How many Observers responded — drives the ≥3 unlock gate. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: a normalized 0–1 score per tribe, in
   * canonical (tribe `number`) order, matching the shape of `score` so the
   * report can rank and render it with the same helpers as the self profile.
   */
  others: TribeScore[];
  /**
   * Each Observer's own individually-normalized profile, in input order, for the
   * anonymous per-observer drill-down (Observer 1 / 2 / 3…). Carries no observer
   * identity — only the scored words, positionally indexed.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile plus each
 * Observer's own normalized profile. The input is not mutated. With no responses
 * the "others" profile is all-zero for every tribe and `perObserver` is empty,
 * so a caller can render a coherent (locked) report before anyone has responded.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseInput[],
): AggregatedObservers {
  const perObserver = responses.map((response) => score(response.words));

  const others = tribes.map((tribe, index) => {
    const total = perObserver.reduce(
      (sum, profile) => sum + profile[index].score,
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
