import "server-only";
import { score, type TribeScore } from "./score";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003) stays locked
 * until at least this many Observers have responded — enough that the aggregate
 * "others" view is meaningful and no single Observer's reading can be singled
 * out from it.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/**
 * Aggregate a set of Observer responses into the equal-weight "others" profile
 * (ADR-0003, PRD story 25).
 *
 * Each Observer's words are scored on their own with the same pure core the
 * Self Assessment uses, so every Observer becomes an individually-normalized
 * 0–1 profile. The "others" score for a tribe is then the plain average of
 * those per-Observer scores — every Observer carries weight `1/N`.
 *
 * This is deliberately NOT a "pooled bag of words" (scoring the union of every
 * Observer's words in one pass), which would let an Observer who selects more
 * words pull the profile toward their reading. Averaging individually-normalized
 * profiles gives every Observer exactly equal say regardless of how many words
 * they picked.
 *
 * Returns one score per tribe in canonical (tribe `number`) order, matching
 * `score()`. With no responses every tribe is 0.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = responses.map((words) => score(words));
  // `score([])` yields the canonical zero profile — every tribe, in order — so
  // the aggregate keeps the same shape and ordering as an individual profile.
  const canonical = score([]);

  return canonical.map((tribe, i) => {
    const total = perObserver.reduce((sum, observer) => sum + observer[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });
}
