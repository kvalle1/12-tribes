import "server-only";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "how others see you" profile is the **equal-weight average of each
 * observer's individually-normalized tribe scores** — NOT a pooled bag of words.
 * Each observer's words are scored on their own through the shared, normalized
 * scoring core (`score`), and those per-observer profiles are then averaged with
 * equal weight. This is the whole point of the design decision: an observer who
 * selects more words does not gain more influence, because normalization caps
 * each observer's own profile before averaging, and averaging (not pooling) gives
 * every observer exactly one equal vote.
 *
 * The module reuses `score` unchanged, so the "others" profile lives on the same
 * 0–1 normalized scale as the Subject's own Self Assessment profile and the two
 * can be compared directly in the report. Server-only because it pulls in the
 * word→tribe mapping via `score` (ADR-0009 trust boundary); the report page
 * computes it server-side and passes only plain `TribeScore` data to the client.
 */

export interface ObserverAggregate {
  /** How many observer responses were aggregated. */
  count: number;
  /**
   * The equal-weight average per-tribe "others" profile, in canonical (tribe
   * `number`) order — each tribe's score averaged across every observer's
   * individually-normalized profile. All-zero when there are no responses.
   */
  others: TribeScore[];
  /**
   * Each observer's own individually-normalized profile, in canonical order,
   * preserved for the anonymous per-observer drill-down (Observer 1/2/3). The
   * order follows the responses passed in (the caller supplies them oldest-first
   * so the anonymous labels are stable); nothing here identifies an observer.
   */
  observers: TribeScore[][];
}

/**
 * Aggregate a set of observer responses into the equal-weight "others" profile.
 * Each response is that observer's selected words; each is scored independently
 * and normalized before averaging, so word count never becomes influence.
 *
 * Unknown/duplicate words within a single response are handled by `score` (a
 * selection is a set). Passing no responses yields a zeroed 12-tribe profile and
 * `count: 0` — the report uses that to render its locked state.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const observers = responses.map((words) => score(words));
  const count = observers.length;

  // Use a scored profile as the canonical tribe template (slug/name/order). With
  // no responses, `score([])` gives the same 12 tribes all at zero.
  const template = count > 0 ? observers[0] : score([]);

  const others = template.map((tribe, i) => ({
    slug: tribe.slug,
    name: tribe.name,
    score:
      count > 0
        ? observers.reduce((sum, profile) => sum + profile[i].score, 0) / count
        : 0,
  }));

  return { count, others, observers };
}
