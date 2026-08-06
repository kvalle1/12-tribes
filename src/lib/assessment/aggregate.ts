import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the equal-weight average of each
 * Observer's *individually-normalized* tribe scores — NOT a pooled bag of words.
 * Each Observer's words are scored with the same normalized core the Subject
 * uses (`score`, ADR-0001), and then the per-tribe scores are averaged across
 * Observers with equal weight. This is the crux of the decision: an Observer who
 * happens to select more words does not gain more influence over the aggregate,
 * because their profile is normalized to itself before it is averaged in.
 *
 * The module depends only on the pure scoring core, so it is unit-testable
 * without the LLM, the database, or the network — the same "pure deep module"
 * shape as `score`, reused by the comparison report.
 */

/**
 * The number of Observer responses required before the comparison report
 * unlocks (ADR-0003). Fewer than this and the average is too thin to be
 * meaningful, and individual Observers are not sufficiently anonymous within the
 * aggregate. Tunable, like the assessment's selection bounds.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether `count` Observer responses is enough to unlock the report. */
export function isReportUnlocked(count: number): boolean {
  return count >= MIN_OBSERVERS_FOR_REPORT;
}

/** One anonymous Observer's normalized profile, for the per-observer drill-down. */
export interface ObserverProfile {
  /**
   * 1-based anonymous label index — "Observer 1", "Observer 2", … — carrying no
   * identity, no relationship, nothing that ties the profile back to a person.
   */
  index: number;
  /** This Observer's individually-normalized 0–1 scores, canonical tribe order. */
  scores: TribeScore[];
}

export interface ObserverAggregate {
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /** Whether the count meets the unlock threshold (ADR-0003). */
  unlocked: boolean;
  /**
   * The equal-weight "others" profile: the per-tribe average of every Observer's
   * individually-normalized score, in canonical (tribe `number`) order. All-zero
   * when there are no Observers.
   */
  others: TribeScore[];
  /** Each Observer's own normalized profile, for anonymous drill-down. */
  perObserver: ObserverProfile[];
}

/** A single anonymous Observer response — only the selected words matter here. */
export interface ObserverResponseWords {
  words: string[];
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile plus each
 * Observer's own normalized profile for drill-down. Responses are expected in a
 * stable order (e.g. oldest first) so the anonymous "Observer N" labels stay
 * consistent between views. The input is never mutated.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseWords[],
): ObserverAggregate {
  const perObserver: ObserverProfile[] = responses.map((response, i) => ({
    index: i + 1,
    scores: score(response.words),
  }));

  const others = averageProfiles(perObserver.map((o) => o.scores));

  return {
    observerCount: responses.length,
    unlocked: isReportUnlocked(responses.length),
    others,
    perObserver,
  };
}

/**
 * Equal-weight per-tribe average of several already-normalized profiles. Every
 * profile is in canonical tribe order, so we can average slot-by-slot. With no
 * profiles, returns an all-zero profile derived from an empty selection (so the
 * tribe list and order are still correct).
 */
function averageProfiles(profiles: readonly TribeScore[][]): TribeScore[] {
  const base = score([]);
  if (profiles.length === 0) return base;

  return base.map((tribe, t) => ({
    slug: tribe.slug,
    name: tribe.name,
    score:
      profiles.reduce((sum, profile) => sum + profile[t].score, 0) /
      profiles.length,
  }));
}
