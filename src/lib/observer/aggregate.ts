import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003) — the "how others see you" half of the comparison report.
 *
 * Each Observer's words are scored individually with the same pure core the Self
 * Assessment uses (`score`), yielding a normalized 0–1 profile per Observer. The
 * "others" profile is the **equal-weight average** of those per-Observer
 * profiles — the mean of each Observer's normalized tribe score — *not* a pooled
 * bag of everyone's words. Averaging normalized profiles is what keeps influence
 * per-Observer: an Observer who selects more words spreads over more tribes but
 * still contributes exactly one profile to the mean, so word count never becomes
 * weight (ADR-0003).
 *
 * `server-only`: it pulls in the word→tribe mapping through `score`, so it must
 * never reach the client. The report page (a server component) runs it and hands
 * the resulting plain `TribeScore[]` data to client components (ADR-0009).
 */

/** How many Observer responses must exist before the comparison report unlocks. */
export const MIN_OBSERVERS = 3;

/**
 * Whether the comparison report may be shown. It unlocks only at
 * `MIN_OBSERVERS` responses, which both makes the average meaningful and keeps
 * individual Observers anonymous within the aggregate (ADR-0003).
 */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

export interface ObserverAggregate {
  /** Number of Observer responses that fed the aggregate. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the per-tribe mean of every Observer's
   * individually-normalized score, in canonical (tribe `number`) order.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized profile, in the order responses were passed
   * in — the source for the anonymous "Observer 1 / 2 / 3" drill-down. Carries
   * no identity: only the scored tribes, never who submitted them.
   */
  perObserver: TribeScore[][];
}

/**
 * Score each Observer's response individually, then average those normalized
 * profiles with equal weight. `responses` is a list of word selections (one per
 * Observer); anything else about an Observer is deliberately absent (ADR-0003).
 * With no responses the average is a zeroed 12-tribe profile.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));

  const average = tribes.map((tribe, i) => {
    const total = perObserver.reduce(
      (sum, profile) => sum + profile[i].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return { observerCount: perObserver.length, average, perObserver };
}

/** A tribe seen from both sides, with the gap between them. */
export interface ProfileComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" score for this tribe. */
  others: number;
  /** `self − others`: positive where the Subject reads higher, negative where others do. */
  delta: number;
}

/**
 * Pair a Subject's own profile against the aggregated "others" profile, tribe by
 * tribe, so the report can show them side by side and surface where they align
 * and where they diverge. Ranked by the stronger of the two scores so the
 * headline tribes lead; ties keep canonical order. Pure and input order-stable.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  return self
    .map((s) => {
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self: s.score,
        others: othersScore,
        delta: s.score - othersScore,
      };
    })
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));
}
