import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003) — the "how others see you" side of the comparison report.
 *
 * Each Observer's words are scored *individually* with the shared Self scoring
 * core (`score`), yielding a normalized 0–1 profile per observer. The "others"
 * profile is then the **equal-weight average** of those per-observer profiles —
 * not a single score over everyone's pooled words. Averaging normalized profiles
 * is what keeps influence equal: an Observer who selects more words already tops
 * out at the same 0–1 range, so word count never buys extra sway (ADR-0003).
 *
 * `server-only` (transitively, via `score`) keeps the word→tribe mapping and all
 * scoring off the client, matching the trust boundary the rest of the flow uses.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003) — enough for the average to mean something and to keep
 * any single Observer anonymous within the pool.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

export interface ObserverAggregate {
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
  /** True once `observerCount` reaches {@link OBSERVER_UNLOCK_THRESHOLD}. */
  unlocked: boolean;
  /**
   * The equal-weight average "others" profile: one normalized 0–1 score per
   * tribe, in canonical (tribe `number`) order. All zero when no one responded.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in submission order, for the
   * anonymous per-observer drill-down (Observer 1 / 2 / 3 …). Carries tribe
   * scores only — never anything identifying who the Observer was.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses (each a list of selected words) into
 * the equal-weight "others" profile plus the per-observer breakdown. Pure and
 * order-independent: it reads only the words, so it is trivially unit-testable
 * and cannot leak observer identity.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  // `score([])` gives the canonical (slug, name) template with every score 0 —
  // the exact shape and order we average into, robust to how score() orders.
  const template = score([]);
  const sums = new Map<string, number>(template.map((t) => [t.slug, 0]));
  for (const profile of perObserver) {
    for (const tribe of profile) {
      sums.set(tribe.slug, (sums.get(tribe.slug) ?? 0) + tribe.score);
    }
  }

  const others: TribeScore[] = template.map((tribe) => ({
    ...tribe,
    score: observerCount > 0 ? (sums.get(tribe.slug) ?? 0) / observerCount : 0,
  }));

  return {
    observerCount,
    unlocked: observerCount >= OBSERVER_UNLOCK_THRESHOLD,
    others,
    perObserver,
  };
}
