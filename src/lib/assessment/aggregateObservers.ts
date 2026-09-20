import "server-only";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003).
 *
 * The "others" profile is the equal-weight average of each Observer's
 * *individually* normalized Strength Profile — every Observer is scored on their
 * own with the same pure core the Subject uses (`score`), then those 0–1
 * profiles are averaged with equal weight. This is deliberately **not** a pooled
 * bag of words: an Observer who selects more words does not gain more influence,
 * because normalization happens per Observer before averaging.
 *
 * Reusing `score` unchanged keeps the self and "others" profiles on the exact
 * same normalized scale, so they can be compared directly. The `server-only`
 * import rides along from `score` (the word→tribe mapping never reaches the
 * client, ADR-0009); the aggregation runs server-side and only its plain numeric
 * output crosses to the view.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded — so the "others" view is statistically meaningful and no single
 * Observer can be singled out from an aggregate this small (ADR-0003).
 */
export const OBSERVER_UNLOCK_THRESHOLD = 3;

export interface ObserverAggregate {
  /** How many Observer responses went into the aggregate. */
  observerCount: number;
  /**
   * The equal-weight average per-tribe "others" profile, in canonical (tribe
   * `number`) order — the same shape and ordering `score` returns.
   */
  others: TribeScore[];
  /**
   * Each Observer's individually-normalized profile, in the same order as the
   * input responses, for the anonymous per-observer drill-down (Observer 1/2/3).
   * Every entry is a full 12-tribe profile in canonical order.
   */
  perObserver: TribeScore[][];
}

/**
 * Score each Observer response individually and return the equal-weight average
 * "others" profile plus the per-observer profiles. With no responses the average
 * is an all-zero profile and `perObserver` is empty. Pure and deterministic: the
 * output depends only on the responses passed in.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  // `score([])` is the canonical all-zero skeleton: it fixes the slug/name and
  // ordering of every tribe, so averaging by index can never drift from the
  // shape `score` produces.
  const others = score([]).map((tribe, index) => ({
    slug: tribe.slug,
    name: tribe.name,
    score:
      observerCount > 0
        ? perObserver.reduce((sum, profile) => sum + profile[index].score, 0) /
          observerCount
        : 0,
  }));

  return { observerCount, others, perObserver };
}

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= OBSERVER_UNLOCK_THRESHOLD;
}

/**
 * One tribe's self-vs-others comparison: the Subject's own normalized score, the
 * equal-weight "others" score, and the gap between them. `delta` is
 * `others − self`, so a positive value means others read the tribe in the
 * Subject more strongly than the Subject reads it in themselves, and a negative
 * value the reverse — the gap being where the most useful insight lives.
 */
export interface TribeComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score for this tribe. */
  others: number;
  /** `others − self`: positive = others see it more; negative = the Subject does. */
  delta: number;
}

/**
 * Pair a Subject's own profile against the aggregated "others" profile,
 * tribe-by-tribe, in canonical order. Both inputs are full 12-tribe profiles
 * from the same `score` core, so they align by slug; pairing by slug keeps this
 * correct even if an input were ordered differently.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): TribeComparison[] {
  const othersBySlug = new Map(others.map((t) => [t.slug, t.score]));
  return self.map((tribe) => {
    const othersScore = othersBySlug.get(tribe.slug) ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      self: tribe.score,
      others: othersScore,
      delta: othersScore - tribe.score,
    };
  });
}
