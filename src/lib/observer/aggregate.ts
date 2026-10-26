import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight "others" aggregation for the 360 comparison report (issue #9,
 * ADR-0003).
 *
 * The one rule that matters here: an Observer who picks more words must not gain
 * more influence than one who picks few. We get that by scoring each Observer
 * *individually* through the same normalized scoring core the Self flow uses
 * (`score`), then taking the plain **equal-weight average** of those per-observer
 * normalized profiles — never by pooling everyone's words into one bag and
 * scoring that (which would let a word-heavy Observer dominate).
 *
 * Because each Observer is normalized to 0–1 before averaging, the resulting
 * "others" profile sits on exactly the same scale as the Subject's own, so the
 * two can be compared directly (see `compare.ts`).
 *
 * `server-only`: this pulls in the word→tribe mapping via `score`, which must
 * never reach the client (ADR-0009 trust boundary).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — enough voices that no single read dominates the "others" profile,
 * and enough anonymity that a Subject can't infer who said what.
 */
export const MIN_OBSERVERS = 3;

/** A single Observer's response, reduced to just the words they selected. */
export interface ObserverResponse {
  readonly words: readonly string[];
}

export interface ObserverAggregate {
  /** How many Observers contributed — drives the ≥3 unlock gate. */
  observerCount: number;
  /**
   * The equal-weight mean of every Observer's normalized per-tribe score, in
   * canonical (tribe `number`) order. All-zero when there are no responses.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized profile (canonical order), in response order,
   * for the anonymous per-observer drill-down (Observer 1 … N). Carries no
   * identity — just the scores derived from that Observer's words.
   */
  perObserver: TribeScore[][];
}

/**
 * Score each Observer response individually and return the equal-weight average
 * "others" profile plus each Observer's own profile for drill-down. Matching is
 * by tribe `slug`, so the average never depends on the positional ordering of
 * the per-observer score arrays.
 */
export function aggregateObservers(
  responses: readonly ObserverResponse[],
): ObserverAggregate {
  const perObserver = responses.map((response) => score(response.words));
  const observerCount = perObserver.length;

  const average: TribeScore[] = tribes.map((tribe) => {
    let sum = 0;
    for (const observerScores of perObserver) {
      const entry = observerScores.find((s) => s.slug === tribe.slug);
      sum += entry ? entry.score : 0;
    }
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });

  return { observerCount, average, perObserver };
}
