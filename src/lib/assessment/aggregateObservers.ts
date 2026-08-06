import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "others" profile is the equal-weight average of each Observer's
 * *individually-normalized* Tribe scores — never a pooled bag of words. Each
 * Observer is scored on their own words with the shared, unchanged scoring core
 * (`score`), so an Observer who selects more words builds a richer personal
 * profile but does not gain more influence over the aggregate: every response
 * contributes exactly `1/N` (PRD story 25).
 *
 * Observers are anonymous (ADR-0003): a response is nothing but a list of words,
 * and the only identity here is a 1-based positional index (Observer 1, Observer
 * 2, …) for the per-observer drill-down. Nothing links a profile back to a
 * person.
 *
 * Transitively `server-only` (it imports the `server-only` scoring core), so the
 * word→tribe mapping never reaches the client. Consume it from server
 * components/route handlers only.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — enough that the aggregate is meaningful and no single Observer can
 * be singled out (ADR-0003). Tunable.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to reveal the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

/** One Observer's individually-normalized profile, labelled only by index. */
export interface ObserverProfile {
  /** Anonymous 1-based label (Observer 1, Observer 2, …). Carries no identity. */
  index: number;
  /** This Observer's normalized 0–1 score per tribe, in canonical order. */
  scores: TribeScore[];
}

export interface ObserverAggregate {
  /** Number of Observer responses aggregated. */
  count: number;
  /** Equal-weight average per-tribe "others" profile, in canonical order. */
  others: TribeScore[];
  /** Each Observer's own profile, in input order, for anonymous drill-down. */
  observers: ObserverProfile[];
}

/**
 * Equal-weight mean of per-observer profiles: for each tribe, the average of
 * that tribe's normalized score across every Observer. Returns an all-zero
 * profile (in canonical order) when there are no responses.
 */
function averageProfiles(perObserver: readonly TribeScore[][]): TribeScore[] {
  return tribes.map((tribe) => {
    const total = perObserver.reduce((sum, scores) => {
      const found = scores.find((s) => s.slug === tribe.slug);
      return sum + (found?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });
}

/**
 * Aggregate a Subject's Observer responses into the "others" profile plus the
 * anonymous per-observer breakdown. `responses` is the list of each Observer's
 * selected words (unknown words are ignored by `score`); order is preserved so
 * the drill-down indices are stable within a single render.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  return {
    count: responses.length,
    others: averageProfiles(perObserver),
    observers: perObserver.map((scores, i) => ({ index: i + 1, scores })),
  };
}
