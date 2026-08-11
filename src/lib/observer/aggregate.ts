import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight "how others see you" aggregation for the 360 comparison report
 * (issue #9, ADR-0003). Each Observer's selected words are scored with the *same*
 * normalized core the Self Assessment uses, then averaged with **equal weight**
 * per tribe — so an Observer who selects more words does not gain more influence
 * (word count never becomes influence). Pure and dependency-free apart from the
 * scoring core; `server-only` because it transitively pulls in the word→tribe
 * mapping through `score` (ADR-0009 trust boundary).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below the threshold the average is not yet meaningful and
 * individual anonymity is weaker, so the report stays locked.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** A single Observer response — just the selected words (Observers are anonymous). */
export interface ObserverResponseWords {
  words: string[];
}

export interface AggregatedObservers {
  /** How many Observer responses were averaged. */
  observerCount: number;
  /**
   * Equal-weight average of each Observer's individually-normalized tribe
   * scores, in canonical (tribe `number`) order. All-zero when there are no
   * Observers.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized scores (canonical order), in input order —
   * the source for the anonymous per-observer drill-down (Observer 1/2/3…).
   */
  perObserver: TribeScore[][];
}

/** Every tribe scored zero, canonical order — the empty-aggregate baseline. */
function zeroScores(): TribeScore[] {
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: 0,
  }));
}

/**
 * Aggregate anonymous Observer responses into the equal-weight "others" profile.
 * Scores each Observer independently (normalized, same core as Self), then for
 * every tribe averages that tribe's score across all Observers. With no
 * Observers the average is all-zero; with one it is simply that Observer's own
 * normalized scores.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseWords[],
): AggregatedObservers {
  const perObserver = responses.map((response) => score(response.words));
  const observerCount = perObserver.length;

  if (observerCount === 0) {
    return { observerCount: 0, average: zeroScores(), perObserver: [] };
  }

  const average = tribes.map((tribe, index) => {
    const total = perObserver.reduce(
      (sum, observer) => sum + observer[index].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: total / observerCount,
    };
  });

  return { observerCount, average, perObserver };
}

/** A tribe's Self score alongside the aggregated "others" score, with the gap. */
export interface TribeComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight average of Observers' normalized scores for this tribe. */
  others: number;
  /** `self − others`: positive where the Subject rates themselves higher. */
  delta: number;
}

/**
 * Pair the Subject's own profile with the aggregated "others" profile, tribe by
 * tribe, in canonical order. `delta` (self − others) is where alignment and
 * divergence live: near-zero is agreement, a large magnitude is a blind spot
 * (others see it, you don't) or an overclaim (you see it, others don't). Both
 * inputs are expected in canonical tribe order (as produced by `score` and
 * `aggregateObservers`); the result is not sorted, leaving display ordering to
 * the caller.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): TribeComparison[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  return self.map((s) => {
    const otherScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: otherScore,
      delta: s.score - otherScore,
    };
  });
}
