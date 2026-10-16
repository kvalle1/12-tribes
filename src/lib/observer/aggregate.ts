import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). This is the "how others see you" half of the comparison report.
 *
 * Each Observer's words are scored with the *same* normalized scoring core the
 * Self flow uses (`score`, ADR-0001/0002), producing a 0–1 profile per Observer.
 * The "others" profile is the **equal-weight average** of those per-Observer
 * profiles — the mean of normalized scores, tribe by tribe. Because every
 * Observer is normalized to 0–1 before averaging, one who selects more words
 * gains no extra influence: effort (word count) never becomes weight. This is
 * deliberately *not* a pooled bag of all Observers' words, where a wordier
 * Observer would dominate.
 *
 * The comparison unlocks only once at least `MIN_OBSERVERS` have responded
 * (ADR-0003): below that the average is too noisy to be meaningful and the
 * individual responses too easy to de-anonymize.
 *
 * Pure and deterministic — it takes the already-fetched word selections and
 * holds no DB or request state, so its external behavior is unit-tested directly
 * (see `aggregate.test.ts`). It is `server-only` because it pulls in the scoring
 * core, which carries the word→tribe mapping that must never reach the client
 * (ADR-0009); the report page calls it server-side.
 */

/**
 * Minimum Observer responses before the comparison report unlocks (ADR-0003).
 * Three is the floor that makes the average meaningful and keeps any single
 * Observer anonymous within the aggregate.
 */
export const MIN_OBSERVERS = 3;

export interface ObserverAggregation {
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
  /** Whether the comparison is unlocked — `observerCount >= MIN_OBSERVERS`. */
  unlocked: boolean;
  /**
   * The equal-weight "others" profile: the mean of each Observer's normalized
   * tribe scores, one entry per tribe in canonical (tribe `number`) order. All
   * zero when there are no Observers.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized score table, in response order, for the
   * anonymous per-observer drill-down (Observer 1 / 2 / 3…). Carries only tribe
   * scores — nothing that identifies who an Observer is.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the per-observer breakdown and the unlock gate. `responses` is
 * one entry per Observer, each the words that Observer selected (already fetched
 * from `observer_response` rows, oldest first).
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregation {
  const perObserver = responses.map((words) => score(words));

  const others: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce((sum, table) => {
      const row = table.find((s) => s.slug === tribe.slug);
      return sum + (row ? row.score : 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return {
    observerCount: perObserver.length,
    unlocked: perObserver.length >= MIN_OBSERVERS,
    others,
    perObserver,
  };
}
