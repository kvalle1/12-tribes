import "server-only";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses into a "how others see you"
 * profile (issue #9, ADR-0003).
 *
 * Each Observer's words are scored *individually* by the shared scoring core —
 * so every Observer is first normalized to a 0–1 profile of their own — and the
 * "others" profile is the plain **average** of those per-observer profiles. This
 * is deliberately not a pooled bag of words: pooling would let an Observer who
 * picks more words carry more influence, whereas equal-weight averaging gives
 * every Observer exactly one vote regardless of how many words they chose.
 *
 * The module reuses `score` verbatim (the same core the Self flow uses), so
 * self and observer profiles are computed identically and are directly
 * comparable. It is `server-only` transitively (via `score`); the report page
 * scores here on the server and passes only the resulting numbers — never the
 * observers' raw words — to the client, keeping the flow anonymous.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below it the average isn't meaningful and a single
 * Observer's answers would be individually identifiable; at or above it the
 * "others" view is both stable and anonymous.
 */
export const MIN_OBSERVERS = 3;

/** Whether enough Observers have responded to reveal the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS;
}

export interface ObserverAggregate {
  /** How many Observer responses went into the aggregate. */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the mean of each Observer's normalized
   * scores, one entry per tribe in canonical (tribe `number`) order.
   */
  scores: TribeScore[];
  /**
   * Each Observer's own normalized scores, in the order responses were passed
   * in — the anonymous per-observer drill-down (Observer 1 / 2 / 3…). Carries
   * only tribe scores; nothing here identifies an Observer.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's Observer responses (each a list of selected words) into
 * the equal-weight "others" profile plus the per-observer breakdown. With no
 * responses the aggregate is an all-zero profile over the 12 tribes and an empty
 * drill-down — the report page treats that (and anything below `MIN_OBSERVERS`)
 * as still locked.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  // `score([])` yields every tribe in canonical order with a 0 score, giving the
  // stable tribe identity/order to fold each observer's scores into. Because
  // `score` always returns tribes in this same order, `perObserver[k][i]` lines
  // up with `template[i]` tribe-for-tribe.
  const template = score([]);

  const scores: TribeScore[] = template.map((tribe, i) => {
    const sum = perObserver.reduce((acc, obs) => acc + obs[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });

  return { observerCount, scores, perObserver };
}
