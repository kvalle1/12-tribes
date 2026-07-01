import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure "others" aggregation for the 360 comparison report (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored *individually* through the same
 * normalized scoring core the Subject uses, then the "others" profile is the
 * **equal-weight average** of those per-observer profiles — tribe by tribe, one
 * vote per observer. It is deliberately not a pooled "bag of words": an Observer
 * who selects more words must not gain more influence (ADR-0003), so we average
 * normalized profiles rather than concatenating everyone's words and scoring the
 * pile once.
 *
 * The module reuses `score` unchanged and adds no scoring rules of its own, so
 * the self and "others" numbers stay directly comparable. It is `server-only`
 * (it pulls in the word→tribe mapping via `score`) — the report page computes
 * the aggregate on the server and passes only the finished numbers to the
 * client (ADR-0009 trust boundary).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded. Three keeps the average meaningful and preserves each Observer's
 * anonymity in the drill-down (ADR-0003).
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** One Observer's anonymous, individually-normalized profile for the drill-down. */
export interface ObserverProfile {
  /** 1-based label index (Observer 1, 2, 3…), assigned by response order only — never an identity. */
  index: number;
  /** This Observer's normalized 0–1 tribe scores, in canonical order. */
  scores: TribeScore[];
}

export interface ObserverAggregate {
  /** Number of Observer responses that fed the aggregate. */
  count: number;
  /** Equal-weight average of the per-observer normalized scores, per tribe, canonical order. */
  average: TribeScore[];
  /** Each Observer's own normalized profile, for anonymous per-observer drill-down. */
  observers: ObserverProfile[];
}

/**
 * Aggregate a Subject's Observer responses into the "others" profile plus the
 * per-observer profiles. Each response is a list of selected words (already
 * gated to the 8–15 range and known-word-filtered when it was recorded, issue
 * #8); scoring simply ignores anything unrecognised. Order of `responses` is the
 * only thing that fixes the anonymous Observer 1..n labels.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const observers: ObserverProfile[] = responses.map((words, i) => ({
    index: i + 1,
    scores: score(words),
  }));

  const count = observers.length;

  // Average tribe by tribe. `score` returns every tribe in canonical order, so
  // we look each observer's tribe up by slug to stay robust rather than lean on
  // positional alignment.
  const average: TribeScore[] = tribes.map((tribe) => {
    const total = observers.reduce(
      (sum, observer) =>
        sum +
        (observer.scores.find((s) => s.slug === tribe.slug)?.score ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? total / count : 0,
    };
  });

  return { count, average, observers };
}
