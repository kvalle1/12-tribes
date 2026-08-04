import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). Each Observer's words are scored *individually* by the shared
 * scoring core — the same coverage-normalized 0–1 profile the Self flow
 * produces — and the "how others see you" profile is the plain average of those
 * per-observer profiles.
 *
 * Averaging the already-normalized profiles (rather than pooling everyone's
 * words into one bag and scoring once) is the whole point: an Observer who
 * selects more words does not gain more influence, because their contribution is
 * capped at their own 0–1 profile before it is averaged in. Effort never becomes
 * weight.
 *
 * `server-only`: this reuses the scoring core, so the word→tribe mapping stays
 * off the client (ADR-0009 trust boundary). The report page computes the
 * comparison on the server and passes only plain scores to the view.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below it, the average isn't meaningful and, with too few
 * responses, individual anonymity is weaker — so the report stays locked.
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

/** Whether enough Observers have responded to reveal the comparison report. */
export function isObserverReportUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}

export interface ObserverAggregate {
  /** How many Observer responses went into the average. */
  observerCount: number;
  /** Equal-weight average normalized score per tribe, in canonical order. */
  scores: TribeScore[];
  /**
   * Each Observer's own normalized profile, in canonical tribe order. The array
   * index is the only handle on an Observer ("Observer 1", "Observer 2", …) —
   * there is deliberately no identity here.
   */
  perObserver: TribeScore[][];
}

/**
 * Score each Observer response individually and return the equal-weight average
 * "others" profile alongside the per-observer profiles. An empty input yields a
 * zeroed profile and no observers.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const scores: TribeScore[] = tribes.map((tribe) => {
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

  return { observerCount, scores, perObserver };
}

/** One tribe's row in the self-vs-others comparison. */
export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /** `others − self`: positive means Observers see more of this tribe than the Subject does. */
  delta: number;
  /** Bar-fill fractions on a scale shared by both profiles (top score across both = 1). */
  relativeSelf: number;
  relativeOthers: number;
}

/**
 * Align a Subject's own profile with the aggregated "others" profile into one
 * row per tribe, carrying both scores, their signed gap, and shared-scale
 * bar-fill fractions so the two series are drawn comparably. Rows are ordered by
 * the stronger of the two signals (desc) so the tribes that matter in *either*
 * profile lead; ties keep canonical (tribe `number`) order. Pure — no scoring,
 * no I/O.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  const max = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  const rows: ComparisonRow[] = self.map((s) => {
    const o = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: o,
      delta: o - s.score,
      relativeSelf: max > 0 ? s.score / max : 0,
      relativeOthers: max > 0 ? o / max : 0,
    };
  });

  // Stable sort (V8) keeps canonical order among equal signals.
  return rows.sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );
}
