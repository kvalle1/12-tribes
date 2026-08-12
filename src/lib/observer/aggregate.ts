import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003) — the
 * "others" side of the self-vs-others comparison report.
 *
 * Each Observer's selected words are scored **individually** through the same
 * pure scoring core the Subject uses (`score`), yielding a normalized 0–1
 * profile per Observer. The "others" profile is then the **equal-weight average
 * of those per-Observer profiles** — every Observer contributes exactly one
 * normalized vector at weight `1/N`, so an Observer who happens to pick more
 * words does not gain more influence. This is deliberately *not* a pooled
 * bag-of-words (where a word-heavy Observer would dominate); pooling is what
 * ADR-0003 rules out.
 *
 * `score` is `server-only`, so this module is server-only too: the word→tribe
 * mapping never reaches the client (ADR-0009). The result shape (`TribeScore[]`
 * in canonical tribe order) matches the Self profile exactly, so the comparison
 * report can rank and render both sides with the same `rankScores` helper.
 */

export interface ObserverAggregate {
  /** Equal-weight average per-tribe "others" profile, in canonical tribe order. */
  others: TribeScore[];
  /**
   * Each Observer's individually-normalized profile, in input (submission)
   * order — the source for the anonymous per-observer drill-down. Carries no
   * Observer identity; the array index is the only handle ("Observer 1/2/3").
   */
  perObserver: TribeScore[][];
  /** How many Observers were aggregated — drives the ≥3 unlock gate. */
  count: number;
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus each Observer's own profile. Each response is a set of selected
 * words (already gated to the 8–15 range and stripped of unknown words when it
 * was recorded, #8); `score` re-applies its own set/exact-match contract, so
 * this is robust to any stray input. With no responses the "others" profile is
 * all-zero and `perObserver` is empty.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const count = perObserver.length;

  const summed: Record<string, number> = {};
  for (const tribe of tribes) summed[tribe.slug] = 0;
  for (const profile of perObserver) {
    for (const tribeScore of profile) summed[tribeScore.slug] += tribeScore.score;
  }

  const others: TribeScore[] = tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: count > 0 ? summed[tribe.slug] / count : 0,
  }));

  return { others, perObserver, count };
}
