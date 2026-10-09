import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses into an "others" profile
 * (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored with the **same** normalized core as
 * the Subject (`score`), producing one 0–1 profile per Observer. The "others"
 * profile is then the plain, **equal-weight average** of those per-observer
 * profiles — not a pooled bag of words. Averaging already-normalized profiles is
 * what keeps every Observer's voice equal: an Observer who picks more words (or
 * who happens to share words with another Observer) gains no extra influence,
 * because their contribution is one profile among N regardless of word count.
 *
 * This module is pure and dependency-free (beyond the scoring core and the tribe
 * list) so its behavior can be unit-tested without a database or the network,
 * and reused unchanged by the comparison report.
 */

export interface ObserverProfile {
  slug: string;
  name: string;
  /** Equal-weight average of the Observers' normalized 0–1 scores for this tribe. */
  score: number;
}

export interface AggregatedObservers {
  /** How many Observer responses were aggregated. */
  count: number;
  /** The equal-weight "others" profile — all 12 tribes, canonical order. */
  others: ObserverProfile[];
  /**
   * Each Observer's own normalized profile, in submission order. Deliberately
   * anonymous: an entry is nothing but a tribe-score table, carrying no name,
   * relationship, or any attribute that could identify who submitted it — the
   * report labels them positionally ("Observer 1", "Observer 2", …).
   */
  perObserver: TribeScore[][];
}

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003): below it the "others" view would be too thin to be
 * meaningful and individual Observers too easy to single out.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

/**
 * Aggregate Observer responses (each a set of selected words) into the
 * equal-weight "others" profile plus the anonymous per-observer breakdown.
 * With no responses, `count` is 0 and every "others" score is 0.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): AggregatedObservers {
  const perObserver = responses.map((words) => score(words));
  const count = perObserver.length;

  // `score()` returns every profile in canonical tribe order, so each tribe's
  // scores line up positionally across observers — no per-tribe slug lookup.
  const others: ObserverProfile[] = tribes.map((tribe, i) => {
    const sum = perObserver.reduce((acc, observer) => acc + observer[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? sum / count : 0,
    };
  });

  return { count, others, perObserver };
}
