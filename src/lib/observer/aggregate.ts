import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Pure aggregation core for the 360 Observer comparison (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the **equal-weight average of each
 * Observer's individually-normalized tribe scores** — every Observer is scored
 * on their own with the same core the Self flow uses (`score`, ADR-0001), and
 * those normalized 0–1 profiles are then averaged tribe-by-tribe. Averaging the
 * *normalized* profiles (rather than pooling every Observer's words into one bag
 * and scoring once) is what keeps each Observer's weight equal: an Observer who
 * selects more words earns a higher raw point total, but their profile is still
 * normalized to 0–1 before it enters the average, so word count never becomes
 * influence.
 *
 * Like `score`, this is server-only: it pulls in the word→tribe mapping through
 * `score`, which must never reach the client (ADR-0009). It is otherwise pure —
 * no persistence, no I/O — so it can be unit-tested directly and reused by the
 * report unchanged.
 */

/** A single anonymous Observer response — just the words, no identity. */
export interface ObserverResponse {
  words: readonly string[];
}

export interface ObserverAggregate {
  /** How many Observer responses were aggregated. */
  count: number;
  /**
   * The equal-weight average "others" profile — one normalized 0–1 score per
   * tribe, in canonical (tribe `number`) order, ready to compare against the
   * Subject's own `score` output.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in submission order, for the
   * anonymous per-observer drill-down (Observer 1 / 2 / 3…). Carries no
   * identity — an entry is only a position in this list.
   */
  perObserver: TribeScore[][];
}

/**
 * The report unlocks only once at least this many Observers have responded
 * (ADR-0003): enough for the average to be meaningful and for no single
 * Observer to be individually identifiable in the drill-down.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether the comparison report is unlocked for the given response count. */
export function isReportUnlocked(count: number): boolean {
  return count >= OBSERVER_UNLOCK_THRESHOLD;
}

/** How many more Observer responses are needed before the report unlocks. */
export function observersRemaining(count: number): number {
  return Math.max(OBSERVER_UNLOCK_THRESHOLD - count, 0);
}

/**
 * Aggregate anonymous Observer responses into the equal-weight "others" profile
 * plus the per-observer breakdown. Each response is scored individually and
 * normalized (via `score`), then the profiles are averaged tribe-by-tribe. An
 * empty set yields a zero profile with `count: 0`.
 */
export function aggregateObservers(
  responses: readonly ObserverResponse[],
): ObserverAggregate {
  const perObserver = responses.map((r) => score(r.words));
  const count = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce((sum, profile) => {
      const row = profile.find((s) => s.slug === tribe.slug);
      return sum + (row ? row.score : 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });

  return { count, others, perObserver };
}
