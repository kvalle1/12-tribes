import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses into an "others" profile
 * (issue #9, ADR-0003).
 *
 * Each Observer is scored *individually* with the same pure scoring core the
 * Self flow uses (`score`), producing a normalized 0–1 profile per Observer.
 * The "others" profile is then the **equal-weight average** of those per-observer
 * profiles — not a pooled bag of every Observer's words. Averaging normalized
 * profiles is what makes each Observer count once: an Observer who selects more
 * words has a denser individual profile but still contributes a single, equally
 * weighted vote, so no one Observer can dominate the aggregate (ADR-0003).
 *
 * `server-only`, because scoring pulls in the word→tribe mapping which must never
 * reach the client (ADR-0009). The report page computes the aggregate here on the
 * server and passes the resulting plain `TribeScore[]` down for rendering.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — below it the "others" view is neither meaningful nor anonymous
 * (ADR-0003). Tunable.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether the comparison report may be shown given `count` Observer responses. */
export function isReportUnlocked(count: number): boolean {
  return count >= OBSERVER_UNLOCK_THRESHOLD;
}

/** The scored words of one anonymous Observer response. */
export interface ObserverResponseInput {
  words: string[];
}

export interface ObserverAggregate {
  /** How many Observers this aggregate is built from. */
  observerCount: number;
  /**
   * The equal-weight average per-tribe "others" profile, in canonical (tribe
   * `number`) order — directly comparable to a Self profile from `score`.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in canonical order, positionally
   * anonymized as Observer 1..N for the drill-down. Carries no identity — the
   * only fields are the tribe slug/name and score.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate anonymous Observer responses into the "others" profile plus each
 * Observer's individual profile for anonymous drill-down. With no responses the
 * "others" profile is all zeros (and `perObserver` empty), so callers can render
 * a well-formed locked state without special-casing the empty input.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseInput[],
): ObserverAggregate {
  const perObserver = responses.map((response) => score(response.words));

  const others: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce(
      // Score tables are in canonical order (score() maps over `tribes`), so the
      // i-th row of every observer profile is this same tribe.
      (sum, profile) => sum + profile[i].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return { observerCount: responses.length, others, perObserver };
}
