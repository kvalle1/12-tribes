import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). The "how others see you" profile is the equal-weight average of
 * each observer's *individually-normalized* tribe scores — not a pooled bag of
 * words — so an observer who selects more words never gains more influence.
 *
 * Every observer is scored by the same pure scoring core the Self flow uses
 * (`score`), which is `server-only` (the word→tribe mapping never reaches the
 * client, ADR-0009); this module inherits that boundary. The output is
 * Strength-Profile-shaped (`TribeScore[]` in canonical tribe order), so it drops
 * straight into `rankScores` and the comparison report alongside the self
 * profile.
 */

/**
 * Minimum number of Observer responses before the comparison report unlocks
 * (ADR-0003). Below this the average isn't meaningful and, with too few
 * responses, anonymity at the individual level would weaken.
 */
export const MIN_OBSERVERS = 3;

export interface ObserverAggregate {
  /**
   * The equal-weight average of every observer's normalized scores, one entry
   * per tribe in canonical (tribe `number`) order. All-zero when there are no
   * observers.
   */
  others: TribeScore[];
  /**
   * Each observer's own normalized profile, in submission order, for the
   * anonymous per-observer drill-down (Observer 1/2/3…). Carries only tribe
   * scores — never anything identifying an observer.
   */
  perObserver: TribeScore[][];
  /** How many observers contributed. */
  count: number;
}

/** Whether enough observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

/**
 * Aggregate a set of observers' selected words into the equal-weight "others"
 * profile plus the per-observer breakdown.
 *
 * Each observer's words are scored independently (normalized, same core as the
 * Self flow), then the per-tribe scores are averaged with equal weight across
 * observers. Because the averaging happens on already-normalized profiles, word
 * count carries no extra influence. Word handling (unknown words dropped,
 * duplicates collapsed, 1/N sharing) is delegated entirely to `score`.
 */
export function aggregateObservers(
  observerWordSets: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = observerWordSets.map((words) => score(words));
  const count = perObserver.length;

  // `score([])` gives the canonical, all-zero tribe table (correct order, slugs,
  // and names) to average into — also the exact result when count === 0.
  const others = score([]).map((tribe, index) => ({
    slug: tribe.slug,
    name: tribe.name,
    score:
      count === 0
        ? 0
        : perObserver.reduce((sum, profile) => sum + profile[index].score, 0) /
          count,
  }));

  return { others, perObserver, count };
}
