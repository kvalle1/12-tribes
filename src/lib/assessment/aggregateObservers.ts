import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003).
 *
 * The "others" profile is the **equal-weight average of each Observer's
 * individually-normalized Tribe scores** — every Observer is scored on their own
 * via the shared pure core (`score`), then those normalized 0–1 profiles are
 * averaged tribe-by-tribe. This is deliberately *not* a pooled bag of words:
 * pooling would let an Observer who picks more words pull the result toward
 * their read, whereas scoring-then-averaging gives each Observer exactly one
 * equal vote no matter how many words they selected.
 *
 * The report is meaningful — and individual Observers stay anonymous — only once
 * enough people have responded, so aggregation reports an `unlocked` flag gated
 * at `MIN_OBSERVERS` (≥3). The module is pure and dependency-free (beyond the
 * scoring core it reuses) so its behavior can be unit-tested without the DB.
 */

/**
 * The minimum number of Observer responses before the comparison report
 * unlocks. Below this the "others" view isn't statistically meaningful and a
 * single Observer could be de-anonymized, so the report stays locked (ADR-0003).
 */
export const MIN_OBSERVERS = 3;

/** One anonymous Observer response — just the words they selected. */
export interface ObserverResponseWords {
  words: string[];
}

export interface ObserverAggregate {
  /** How many Observers have responded. */
  observerCount: number;
  /** The unlock threshold, echoed so the UI can render "N of 3". */
  minObservers: number;
  /** Whether the report unlocks (`observerCount >= minObservers`). */
  unlocked: boolean;
  /**
   * The equal-weight "others" profile: for each tribe, the mean of the
   * Observers' individually-normalized scores. Full 12-tribe set in canonical
   * (tribe `number`) order, so it lines up with `score()` output and feeds
   * `rankScores` directly. All zeros when there are no Observers.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized 12-tribe profile, in response order. Carries
   * no identity — the index is the only handle, surfaced as "Observer 1/2/3" —
   * so the Subject can inspect the spread of opinion without identifying anyone.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate anonymous Observer responses into the equal-weight "others" profile
 * for a Subject. Each response is scored independently (unknown words and
 * duplicates dropped by the scoring core), then the normalized profiles are
 * averaged with equal weight per Observer.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseWords[],
  minObservers: number = MIN_OBSERVERS,
): ObserverAggregate {
  const perObserver = responses.map((response) => score(response.words));
  const observerCount = perObserver.length;

  const average: TribeScore[] = tribes.map((tribe, index) => {
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

  return {
    observerCount,
    minObservers,
    unlocked: observerCount >= minObservers,
    average,
    perObserver,
  };
}
