import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). The "how others see you" profile is the **equal-weight average of
 * each observer's individually-normalized tribe scores** — not a pooled bag of
 * words. Each observer is scored with the same coverage-fair core as the Self
 * flow (`score`), yielding a 0–1 profile, and the averages are the plain mean of
 * those profiles. Because every observer is normalized to the same 0–1 scale
 * *before* averaging, an observer who selects more words gains no extra
 * influence — effort never becomes weight.
 *
 * The comparison report built on this unlocks only once at least `MIN_OBSERVERS`
 * observers have responded: below that the average isn't meaningful and
 * individual anonymity is weak, so callers gate on `unlocked`.
 *
 * `server-only`: it pulls in the `server-only` scoring core (the word→tribe
 * mapping never reaches the client, ADR-0009), so render its output only from
 * server components.
 */

/**
 * Minimum number of Observer responses before the comparison report unlocks.
 * Three keeps the average from being dominated by one voice and preserves
 * anonymity at the individual level (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

export interface ObserverAggregate {
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /** Whether at least `MIN_OBSERVERS` responses exist — the report's unlock gate. */
  unlocked: boolean;
  /**
   * The equal-weight "others" profile: for each tribe (canonical `number`
   * order), the mean of every observer's normalized score for that tribe. All
   * zeros when there are no observers.
   */
  average: TribeScore[];
  /**
   * Each observer's own normalized 12-tribe profile, in input order, for the
   * anonymous per-observer drill-down (Observer 1/2/3…). Carries no identity —
   * only scores — so it can never surface who an observer is.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the per-observer drill-down. Each response is a list of selected
 * words; the scoring core deduplicates and drops unknown words, so a response is
 * treated as a set. Input order is preserved in `perObserver` for stable
 * Observer 1/2/3 labelling.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const average: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, profile) => sum + profile[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return {
    observerCount,
    unlocked: observerCount >= MIN_OBSERVERS,
    average,
    perObserver,
  };
}
