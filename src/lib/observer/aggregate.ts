import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003) — the "others"
 * half of the self-vs-others comparison report.
 *
 * Each Observer's selected words are scored through the very same normalized
 * scoring core the Subject's Self Assessment uses (`score`), so an Observer
 * profile and a Self profile are on the same 0–1 per-tribe scale and are
 * directly comparable. The aggregated "others" profile is then the **equal-weight
 * average of those per-observer profiles** — the mean, over observers, of each
 * tribe's normalized score.
 *
 * Averaging per-observer *normalized* scores (rather than pooling everyone's
 * words into one bag and scoring that) is the whole point: because each
 * observer's per-tribe score is already bounded to 0–1 regardless of how many
 * words they picked, an observer who selects fifteen words carries exactly the
 * same weight as one who selects eight. Pooling would instead let the wordier
 * observer dominate. See the tests for a concrete case where the two diverge.
 *
 * Pure and dependency-light (only the tribe list and the scoring core), so it is
 * unit-testable on its own and reused unchanged by the comparison report.
 */

/**
 * The report unlocks only once at least this many Observers have responded, so a
 * Subject can't reverse-engineer a single anonymous Observer's answers from the
 * aggregate. Below the threshold the comparison stays locked (ADR-0003).
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** One anonymous Observer's submission — just the words they picked. */
export interface ObserverResponseInput {
  words: readonly string[];
}

export interface AggregatedObservers {
  /** How many Observers have responded. */
  observerCount: number;
  /** Whether the comparison is unlocked (≥ {@link OBSERVER_UNLOCK_THRESHOLD}). */
  unlocked: boolean;
  /**
   * The equal-weight "others" profile: for every tribe, the mean of the
   * per-observer normalized scores. In canonical (tribe `number`) order. All
   * zeros when there are no Observers.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized 12-tribe profile, in the order the responses
   * were provided (Observer 1, Observer 2, …). Anonymous by construction — a
   * profile carries nothing about who the Observer is. Backs the per-observer
   * drill-down in the report.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the per-observer profiles behind it. Order is preserved so the
 * report can label them Observer 1/2/3 without attaching any identity.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseInput[],
): AggregatedObservers {
  const perObserver = responses.map((response) => score(response.words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe) => {
    const sum = perObserver.reduce((total, profile) => {
      const forTribe = profile.find((t) => t.slug === tribe.slug);
      return total + (forTribe?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });

  return {
    observerCount,
    unlocked: observerCount >= OBSERVER_UNLOCK_THRESHOLD,
    others,
    perObserver,
  };
}
