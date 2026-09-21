import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";
import { tribes } from "@/lib/tribes";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). Each Observer is scored individually with the exact same normalized
 * scoring core the Self flow uses (`score`), and the "how others see you"
 * profile is the **equal-weight average** of those per-observer vectors — never a
 * pooled bag of words. Scoring per observer first, then averaging the vectors,
 * is what keeps a wordier observer from gaining more influence than a terse one:
 * every observer contributes exactly one vote regardless of how many words they
 * picked.
 *
 * `server-only`: it pulls in the `server-only` scoring core (and, through it, the
 * word→tribe mapping), so it must never reach the client (ADR-0009 trust
 * boundary). Callers hand the plain result data to the view.
 */

/** The minimum number of Observer responses before the comparison unlocks. */
export const MIN_OBSERVERS = 3;

/** A single anonymous Observer response — just its selected words. */
export interface ObserverResponse {
  readonly words: readonly string[];
}

export interface AggregatedObservers {
  /** How many Observers have responded. */
  observerCount: number;
  /** Whether the comparison report unlocks (≥ {@link MIN_OBSERVERS}). */
  unlocked: boolean;
  /**
   * The equal-weight "others" profile: for each tribe, the mean of the
   * observers' individually-normalized scores. All twelve tribes in canonical
   * (tribe `number`) order; all-zero when there are no observers.
   */
  scores: TribeScore[];
  /**
   * Each observer's own normalized 12-tribe vector, in input order, backing the
   * anonymous per-observer drill-down (Observer 1/2/3…). Carries no identity.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the per-observer breakdown. Pure and deterministic: the same
 * responses always produce the same profile, and the input is never mutated.
 */
export function aggregateObservers(
  responses: readonly ObserverResponse[],
): AggregatedObservers {
  const perObserver = responses.map((response) => score(response.words));
  const observerCount = perObserver.length;

  const scores: TribeScore[] = tribes.map((tribe, index) => {
    const total = perObserver.reduce((sum, vector) => sum + vector[index].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return {
    observerCount,
    unlocked: observerCount >= MIN_OBSERVERS,
    scores,
    perObserver,
  };
}
