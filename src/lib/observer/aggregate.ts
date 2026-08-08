import "server-only";
import { score, type TribeScore } from "@/lib/assessment/score";
import { tribes } from "@/lib/tribes";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003) — the deep module
 * behind the self-vs-others comparison report. The `server-only` marker keeps it
 * (and the word→tribe scoring core it pulls in) off the client, same trust
 * boundary as the Self flow.
 *
 * The one idea that matters here: each Observer is scored **individually** with
 * the same normalized core the Self flow uses, and only then are the per-tribe
 * scores **averaged with equal weight**. Averaging independently-normalized
 * profiles — rather than pooling everyone's words into a single bag and scoring
 * once — is precisely what stops an Observer who picks more words from counting
 * for more than one who picks fewer.
 */

/**
 * The minimum number of Observer responses before the comparison report
 * unlocks. Below it the Subject sees a locked state instead of the report: a
 * small floor keeps the "others" read from being any single person's opinion and
 * blunts inferring who an individual Observer was from a near-empty aggregate.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isObserverReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_TO_UNLOCK;
}

export interface ObserverAggregate {
  /** How many Observers responded. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the per-tribe arithmetic mean of each
   * Observer's independently-normalized score, in canonical (tribe `number`)
   * order.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized profile, in response order — the raw material
   * for the anonymous "Observer 1/2/3" drill-down. Carries scores only, never
   * anything identifying who an Observer was.
   */
  observers: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer word-selections into the equal-weight "others"
 * profile the comparison report renders. Each entry in `responses` is one
 * Observer's selected words; the returned `average` is the mean of the
 * per-Observer normalized profiles, and `observers` preserves each profile in
 * the given order for the anonymous drill-down.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const observers = responses.map((words) => score(words));
  return {
    observerCount: observers.length,
    average: averageProfiles(observers),
    observers,
  };
}

/**
 * The per-tribe arithmetic mean of a set of normalized profiles, in canonical
 * order. With no profiles every tribe averages to 0, so callers can render a
 * neutral "others" profile without special-casing the empty set.
 */
function averageProfiles(profiles: readonly TribeScore[][]): TribeScore[] {
  const totals = new Map<string, number>(tribes.map((t) => [t.slug, 0]));
  for (const profile of profiles) {
    for (const ts of profile) {
      totals.set(ts.slug, (totals.get(ts.slug) ?? 0) + ts.score);
    }
  }
  const divisor = profiles.length || 1;
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: (totals.get(tribe.slug) ?? 0) / divisor,
  }));
}
