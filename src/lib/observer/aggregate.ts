import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). The "how others see you" profile is the **equal-weight average of
 * each observer's individually-normalized tribe scores** — deliberately *not* a
 * pooled bag of words. Each observer is scored on their own with the same
 * normalized core the Subject uses (`score`, ADR-0001), then those per-observer
 * profiles are averaged one-observer-one-vote. Because every observer's scores
 * are already normalized to 0–1 before averaging, an observer who happens to
 * pick more words gains no extra influence (ADR-0003).
 *
 * This module is a pure, server-only deep function: words in, an aggregated
 * profile out, with no I/O. It is server-only because it pulls in the scoring
 * core (which carries the word→tribe mapping, ADR-0009); the report page runs
 * it on the server and passes only the resulting numbers to the view.
 */

/** The minimum number of observer responses before the comparison unlocks. */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether `count` observer responses is enough to unlock the comparison report. */
export function isReportUnlocked(count: number): boolean {
  return count >= OBSERVER_UNLOCK_THRESHOLD;
}

export interface ObserverAggregate {
  /** How many observers were aggregated. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the average of the per-observer
   * normalized scores, one `TribeScore` per tribe in canonical (tribe `number`)
   * order. All-zero when there are no observers.
   */
  others: TribeScore[];
  /**
   * Each observer's own normalized scores, in the input order, canonical tribe
   * order within each. Backs the anonymous per-observer drill-down (Observer
   * 1/2/3) — it carries scores only, never any observer identity.
   */
  perObserver: TribeScore[][];
}

/**
 * Score each observer's word selection individually and return the equal-weight
 * average per-tribe "others" profile plus the individual per-observer profiles.
 *
 * Each entry of `observerWordLists` is one observer's selected words. Scoring is
 * the same normalized core the Subject's own result uses, so self and others are
 * directly comparable, and averaging the *normalized* per-observer scores (not
 * pooling raw words) keeps every observer's vote equal regardless of how many
 * words they picked.
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = observerWordLists.map((words) => score([...words]));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe) => {
    const sum = perObserver.reduce((acc, observer) => {
      const tribeScore = observer.find((s) => s.slug === tribe.slug);
      return acc + (tribeScore?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });

  return { observerCount, others, perObserver };
}
