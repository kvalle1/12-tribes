import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * Each Observer's words are scored with the same normalized core the Subject's
 * Self Assessment uses (`score`), producing that Observer's own 0–1 Strength
 * Profile. The "how others see you" profile is the **equal-weight average** of
 * those per-observer profiles — not a pooled bag of words. Averaging normalized
 * per-observer profiles is what makes an Observer who selects more words carry no
 * more influence than one who selects fewer: each Observer contributes exactly
 * one profile to the mean.
 *
 * The module is `server-only` because it imports the scoring core (which pulls in
 * the word→tribe mapping); the comparison report renders it from a server
 * component. It is otherwise pure and dependency-free so it can be unit-tested
 * without the LLM, the DB, or React.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below it the "others" view would be neither meaningful
 * nor anonymous at the individual level, so the report stays locked.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

export interface ObserverAggregate {
  /** How many Observers responded. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the per-tribe mean of the observers'
   * individually-normalized scores, in canonical (tribe `number`) order.
   */
  profile: TribeScore[];
  /**
   * Each Observer's own normalized profile, in response order, in canonical
   * tribe order — the source for the anonymous "Observer 1/2/3" drill-down. It
   * carries no observer identity, only their scores.
   */
  perObserver: TribeScore[][];
  /** Whether the report may be shown (`observerCount >= MIN_OBSERVERS_FOR_REPORT`). */
  unlocked: boolean;
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile. Each response is a list of the words that Observer selected;
 * responses should be passed in a stable order (e.g. by creation time) so the
 * per-observer drill-down numbering stays consistent. An empty list yields an
 * all-zero, locked profile.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const profile: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, observer) =>
        sum + (observer.find((t) => t.slug === tribe.slug)?.score ?? 0),
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
    profile,
    perObserver,
    unlocked: observerCount >= MIN_OBSERVERS_FOR_REPORT,
  };
}
