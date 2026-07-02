import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored independently with the same
 * normalized scoring core the Subject uses (`score`), then the per-tribe scores
 * are averaged across Observers with **equal weight** — one vote per Observer,
 * regardless of how many words they picked. This is deliberately *not* a pooled
 * bag of words (`score(allWordsCombined)`): pooling would let a verbose Observer
 * dominate the "others" profile, whereas equal-weight averaging keeps every
 * Observer's read counted the same (ADR-0003).
 *
 * The module is pure and dependency-free (beyond the scoring core and the tribe
 * list) so it can be unit-tested without the DB, and reused unchanged by the
 * comparison report. It does not enforce the 8–15 selection range — that gate
 * lives at recording time in the observer repository (issue #8); this module
 * simply averages whatever responses it is given.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003) — enough to make the "others" view meaningful and to keep
 * any single Observer anonymous within the aggregate.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

export interface ObserverAggregate {
  /**
   * The equal-weight average per-tribe "others" profile, in canonical (tribe
   * `number`) order — the same shape and ordering as `score`.
   */
  scores: TribeScore[];
  /**
   * Each Observer's individual normalized profile, in the order responses were
   * supplied. Backs the anonymous per-Observer drill-down (Observer 1/2/3); the
   * order carries no identity.
   */
  perObserver: TribeScore[][];
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /** Whether the comparison report may be shown (`observerCount ≥ threshold`). */
  unlocked: boolean;
}

/**
 * Aggregate anonymous Observer responses into an equal-weight "others" profile.
 * Each response is a set of selected words; each is scored independently and the
 * results are averaged one-vote-per-Observer. With no responses, every tribe
 * scores 0 and the report stays locked.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));

  const scores: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, obs) => sum + obs[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return {
    scores,
    perObserver,
    observerCount: perObserver.length,
    unlocked: perObserver.length >= OBSERVER_UNLOCK_THRESHOLD,
  };
}
