import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003) — the pure core of
 * the self-vs-others comparison report.
 *
 * Each Observer's words are scored with the *same* normalized core the Self
 * flow uses (`score`), producing a 0–1 profile per Observer. The "others"
 * profile is then the **equal-weight average** of those per-Observer profiles:
 * every Observer contributes exactly one vote per tribe, regardless of how many
 * words they picked. This is deliberately *not* a pooled "bag of words" — an
 * Observer who selects more words cannot drown out one who selects fewer,
 * because each Observer is individually normalized *before* averaging.
 *
 * The module is pure and dependency-free (beyond the shared scoring core and the
 * tribe list) so it is unit-testable without a database or the network, and
 * reuses `score` unchanged rather than re-deriving the scoring math.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003): below it the "others" view is neither meaningful nor
 * anonymous enough, so the report stays locked.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

export interface ObserverAggregate {
  /**
   * The equal-weight averaged "others" profile — one normalized 0–1 score per
   * tribe, in canonical (tribe `number`) order. All-zero when there are no
   * responses.
   */
  scores: TribeScore[];
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /**
   * Each Observer's own normalized profile, in input order. Deliberately
   * anonymous — a bare list of score tables with no identity attached, so the
   * report can show "Observer 1 / 2 / 3" drill-down without ever naming anyone.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the per-Observer breakdown. Each response is a list of selected
 * words (the same shape the Self flow scores); unknown words and duplicates are
 * handled by `score`. Returns an all-zero profile with `observerCount: 0` for an
 * empty list, so callers can gate on `observerCount` without special-casing.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const scores: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce((sum, table) => {
      const entry = table.find((t) => t.slug === tribe.slug);
      return sum + (entry?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { scores, observerCount, perObserver };
}
