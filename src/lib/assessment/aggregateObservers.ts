import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored individually with the same
 * normalized scoring core the Subject uses (`score`), yielding a per-tribe 0–1
 * vector. The "others" profile is the **equal-weight average** of those
 * per-observer vectors — each Observer contributes exactly one vote, so an
 * Observer who selects more words does **not** gain more influence. This is the
 * deliberate difference from pooling every Observer's words into one bag and
 * scoring once, where a prolific Observer would dominate.
 *
 * The module is pure and dependency-light (only the scoring core and the tribe
 * list) so its external behavior can be unit-tested directly, and it carries no
 * Observer identity — the input is just lists of words, and the output exposes
 * per-observer vectors only as anonymous, order-stable entries for drill-down.
 */

/** Minimum Observer responses before the comparison report unlocks (ADR-0003). */
export const MIN_OBSERVERS_FOR_REPORT = 3;

export interface ObserversProfile {
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /**
   * The equal-weight average normalized score per tribe, in canonical (tribe
   * `number`) order — the aggregated "others" view of the Subject.
   */
  scores: TribeScore[];
  /**
   * Each Observer's own normalized scores, in the same canonical tribe order,
   * ordered as the responses were supplied. Anonymous: an entry carries no
   * identity, only its scores, so the report can show "Observer 1 / 2 / 3"
   * without ever revealing who responded.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile. `null`
 * and duplicate handling live in `score`; this layer only averages. With no
 * responses it returns a zeroed 12-tribe profile (count 0) so callers can render
 * a stable locked state without special-casing.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserversProfile {
  // Order the per-observer vectors by a content-derived key rather than the
  // order they were supplied in. The Subject knows who they sent links to and
  // often in what order people replied, so labelling the drill-down by arrival
  // order ("Observer 1" = first to respond) would quietly de-anonymize it.
  // A content key makes "Observer N" stable across loads yet carries no arrival
  // signal. Averaging is order-independent, so this never affects `scores`.
  const perObserver = responses
    .map((words) => score(words))
    .sort((a, b) => observerSortKey(a).localeCompare(observerSortKey(b)));
  const observerCount = perObserver.length;

  const scores: TribeScore[] = tribes.map((tribe, index) => {
    const total = perObserver.reduce((sum, obs) => sum + obs[index].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, scores, perObserver };
}

/**
 * A deterministic, content-derived ordering key for one observer's scored
 * vector. Depends only on the scores (in canonical tribe order), never on when
 * the response arrived, so the drill-down order can't be read as a response
 * timeline. Two observers who picked identical words sort together — which is
 * fine, since they're indistinguishable anyway.
 */
function observerSortKey(scores: readonly TribeScore[]): string {
  return scores.map((s) => s.score.toFixed(6)).join(",");
}

/**
 * Whether the self-vs-others comparison report may be shown. Gated to
 * `MIN_OBSERVERS_FOR_REPORT` so the "others" view is meaningful and no single
 * Observer can be singled out from a tiny pool (ADR-0003).
 */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}
