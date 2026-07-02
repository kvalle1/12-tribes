import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure aggregation of 360 Observer responses into a single "how others see you"
 * profile (issue #9, ADR-0003).
 *
 * Each Observer is scored individually with the same normalized scoring core as
 * the Self Assessment, then those per-observer profiles are averaged with EQUAL
 * WEIGHT — not by pooling everyone's words into one bag. Because each observer's
 * scores are already normalized 0–1 per tribe before averaging, an Observer who
 * selects more words does not gain more influence over the result (ADR-0003).
 *
 * The module leans on `score()` (which is `server-only`) so it inherits the same
 * trust boundary: the word→tribe mapping never reaches the client. The report UI
 * receives only the computed `TribeScore` arrays.
 */

/**
 * Minimum number of Observer responses before the comparison report unlocks
 * (ADR-0003). Below this the aggregate is statistically thin and, just as
 * importantly, a small pool would erode individual Observer anonymity.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to reveal the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

export interface ObserverAggregate {
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: for each tribe, the mean of every
   * observer's individually-normalized score. Canonical (tribe `number`) order.
   */
  others: TribeScore[];
  /**
   * Each Observer's individual normalized profile, in the order supplied — the
   * source of the anonymous "Observer 1/2/3…" drill-down. Carries no observer
   * identity; it is just a list of scored profiles.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a set of Observer word-selections into the equal-weight "others"
 * profile plus each Observer's individual profile. Order of the input list is
 * preserved in `perObserver` (used only for anonymous "Observer N" labels); the
 * responses themselves carry no identity.
 */
export function aggregateObservers(
  observerWordLists: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = observerWordLists.map((words) => score(words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce(
      (sum, profile) =>
        sum + (profile.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, others, perObserver };
}

export interface ProfileComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /**
   * `self − others`: positive where the Subject sees more of this tribe in
   * themselves than others do, negative where others see more than they do. The
   * largest-magnitude deltas are where self and 360 diverge most.
   */
  delta: number;
}

/**
 * Pair a Subject's self profile against the aggregated "others" profile, tribe
 * by tribe, in canonical order. Pure and client-safe (operates on already-scored
 * `TribeScore[]`), so the report view can compute alignment and divergence from
 * it without importing the scoring core.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparisonRow[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));
  return self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersScore,
      delta: s.score - othersScore,
    };
  });
}
