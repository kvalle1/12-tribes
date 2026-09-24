import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "others" profile is the **equal-weight average of each Observer's
 * individually-normalized Tribe scores** — *not* a pooled bag of everyone's
 * words. Each Observer is scored on their own with the same normalized core the
 * Subject uses (`score`), then those per-observer profiles are averaged with one
 * vote each. So an Observer who picks fifteen words carries exactly the same
 * weight as one who picks eight; no single Observer can dominate the aggregate by
 * selecting more (ADR-0003, PRD story 25).
 *
 * Kept dependency-free (only the scoring core + the tribe list) so it can be
 * unit-tested in isolation and reused unchanged by the comparison report. It is
 * `server-only` because `score` is — the word→tribe mapping never reaches the
 * client (ADR-0009) — but the `server-only` marker is stubbed under Vitest, so
 * the module is still directly testable.
 */

/**
 * Minimum number of Observer responses before the comparison report unlocks.
 * Below this the "others" view is withheld so it stays meaningful and no single
 * Observer is identifiable (ADR-0003, PRD story 23).
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function hasEnoughObservers(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

/** One Observer's submission — just their selected words; never their identity. */
export interface ObserverResponseInput {
  readonly words: readonly string[];
}

/**
 * One Observer scored individually, for the anonymous drill-down. `index` is a
 * 1-based label ("Observer 1", "Observer 2", …) assigned in input order and
 * carrying no identifying attributes (PRD story 26).
 */
export interface ObserverProfile {
  readonly index: number;
  readonly scores: TribeScore[];
}

/** The aggregated "others" view plus the per-observer breakdown behind it. */
export interface ObserversAggregate {
  /** How many Observer responses went into the aggregate. */
  readonly observerCount: number;
  /**
   * Equal-weight average normalized score per tribe, in canonical (tribe
   * `number`) order — the same ordering `score` emits.
   */
  readonly average: TribeScore[];
  /** Each Observer scored on their own, anonymous, in input order. */
  readonly perObserver: ObserverProfile[];
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile.
 *
 * Each response is scored independently (`score`), then the per-tribe scores are
 * averaged across Observers with equal weight (sum ÷ count), so word-count never
 * buys influence. Canonical tribe order is preserved and the average is built
 * from the full `tribes` list, so an empty input yields every tribe at 0 with an
 * `observerCount` of 0 (the report's locked state) rather than an empty array.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseInput[],
): ObserversAggregate {
  const perObserver: ObserverProfile[] = responses.map((response, i) => ({
    index: i + 1,
    scores: score(response.words),
  }));

  const observerCount = perObserver.length;

  const average: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce((sum, observer) => {
      const tribeScore =
        observer.scores.find((s) => s.slug === tribe.slug)?.score ?? 0;
      return sum + tribeScore;
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, average, perObserver };
}
