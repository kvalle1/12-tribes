import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of the 360 Observer responses (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored with the very same pure core the Self
 * flow uses (`score`), which normalizes every tribe to a 0–1 value. The "others"
 * profile is then the **equal-weight average of those individually-normalized
 * per-observer profiles** — the mean of each Observer's normalized score for a
 * tribe — *not* a pooled bag of everyone's words. Averaging already-normalized
 * profiles is what keeps every Observer's voice equal: an Observer who picks more
 * words does not gain more influence, because their own profile is normalized to
 * 0–1 before it is averaged in (PRD story 25).
 *
 * The module is server-only: it depends on the `server-only` scoring core, so the
 * word→tribe mapping never reaches the client (ADR-0009 trust boundary). The
 * comparison report renders it from a server component.
 */

/**
 * How many Observer responses must exist before the comparison report unlocks
 * (ADR-0003). Below this the "others" view is neither statistically meaningful
 * nor safely anonymous, so the report stays locked. Tunable.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

export interface ObserverAggregate {
  /** How many Observer responses went into this aggregate. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: for each tribe, the mean of the
   * Observers' individually-normalized scores. Canonical (tribe `number`) order,
   * matching `score`. All zeros when there are no responses.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in canonical order — one entry per
   * response, used for the anonymous per-observer drill-down (Observer 1/2/3).
   * Carries no Observer identity; the array index is just a display label.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate anonymous Observer responses (each a list of selected words) into the
 * equal-weight "others" profile plus each Observer's individual profile.
 *
 * `score` returns one entry per tribe in canonical order, so the per-observer
 * profiles all line up index-for-index with `tribes` and with each other; the
 * average is taken position-by-position on that shared ordering. The input is
 * never mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe, index) => {
    const total = perObserver.reduce((sum, profile) => sum + profile[index].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, others, perObserver };
}
