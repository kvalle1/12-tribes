import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of the 360 Observer responses into a single "how
 * others see you" profile (issue #9, ADR-0003).
 *
 * Each Observer is scored on their own with the same normalized core the Self
 * flow uses (`score`), and the "others" profile is the **mean of those
 * per-observer normalized scores** — deliberately *not* a pooled bag of everyone's
 * words. Normalizing before averaging is what keeps an Observer who selects more
 * words from gaining more influence: every Observer's profile counts exactly
 * once, whether they picked 8 words or 15.
 *
 * Server-only: it pulls in the word→tribe mapping via `score`, which must never
 * reach the client (ADR-0009). Aggregation runs server-side only.
 */

/**
 * The minimum number of Observer responses required before the comparison report
 * unlocks (ADR-0003). Below this the average isn't meaningful and individual
 * anonymity is thin, so the report stays locked until at least three people have
 * answered.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

export interface ObserverAggregate {
  /**
   * The equal-weight "others" profile: for each tribe, the mean of every
   * Observer's individually-normalized score for that tribe, in canonical
   * (tribe `number`) order.
   */
  scores: TribeScore[];
  /**
   * Each Observer's own individually-normalized 12-tribe scores, in the order
   * the responses were given. Anonymous by construction — index `i` is
   * "Observer i + 1" and carries no identity. Backs the per-observer drill-down.
   */
  perObserver: TribeScore[][];
  /** How many Observer responses went into the aggregate. */
  observerCount: number;
}

/**
 * Aggregate a Subject's Observer responses (each a list of selected words) into
 * the equal-weight "others" profile plus the per-observer breakdown. With no
 * responses every tribe scores 0 and `observerCount` is 0 — callers gate on the
 * count (see `isReportUnlocked`) before showing the report.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  // Normalize each Observer independently before averaging (ADR-0003).
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const scores: TribeScore[] = tribes.map((tribe, index) => {
    // `score` returns tribes in canonical order, so column `index` is this tribe
    // across every observer.
    const total = perObserver.reduce(
      (sum, observer) => sum + observer[index].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { scores, perObserver, observerCount };
}
