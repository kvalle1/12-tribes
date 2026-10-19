import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses into an "others"
 * profile (issue #9, ADR-0003).
 *
 * Each Observer is scored **individually** with the same normalized scoring core
 * the Self Assessment uses (`score`), then the per-observer normalized profiles
 * are averaged with **equal weight** — 1/N each. This is deliberately *not* a
 * pooled bag of words: pooling would let an Observer who selects more words (or
 * whose words another Observer happened to repeat) sway the result more than
 * one who selects fewer, and would risk pushing a tribe past the 0–1 scale the
 * Self profile lives on. Scoring each Observer separately and averaging keeps
 * every Observer's voice the same size and keeps "others" directly comparable to
 * "self".
 *
 * The module is `server-only` (it pulls in the scoring core, which carries the
 * word→tribe mapping, ADR-0009) and dependency-free beyond `score`, so it stays
 * unit-testable in isolation. It takes raw word lists — one per Observer — and
 * never sees or returns any Observer identity, keeping the 360 flow anonymous.
 */

/** The number of Observer responses required before the comparison report unlocks. */
export const MIN_OBSERVERS = 3;

/**
 * Whether the self-vs-others comparison report may be shown. It unlocks only
 * once at least `MIN_OBSERVERS` Observers have responded, so the "others" view
 * is meaningful and no single Observer can be singled out (ADR-0003).
 */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Order Observer responses for the anonymous drill-down by their **content**
 * rather than submission time. The repository returns responses in creation
 * order; displaying them that way would let a Subject who knows roughly when
 * each person replied map "Observer 1/2/3" back to an individual, which the
 * 3-observer floor alone doesn't prevent. Sorting by a stable key derived from
 * the selected words (order-insensitive) decouples the labels from timing while
 * staying deterministic across page loads. Responses with identical content are
 * interchangeable, so their relative order carries no information. Pure; the
 * input is not mutated.
 */
export function orderObserverResponses(
  responses: readonly (readonly string[])[],
): string[][] {
  const keyed = responses.map((words) => ({
    words: [...words],
    key: [...words].sort().join("\u0000"),
  }));
  keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return keyed.map((entry) => entry.words);
}

export interface ObserverAggregate {
  /** How many Observers contributed to this aggregate. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the mean of each Observer's individually
   * normalized tribe score, in canonical (tribe `number`) order.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized profile, in canonical order, kept in input
   * order for anonymous drill-down (Observer 1, Observer 2, …). Carries scores
   * only — never anything that identifies an Observer.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate Observer responses (each a list of selected words) into the
 * equal-weight "others" profile plus the individual per-observer profiles that
 * back the anonymous drill-down. With no responses the average is all-zero and
 * every tribe is still present in canonical order. The input is not mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const average = tribes.map((tribe) => {
    const total = perObserver.reduce((sum, scores) => {
      const found = scores.find((s) => s.slug === tribe.slug);
      return sum + (found ? found.score : 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, average, perObserver };
}
