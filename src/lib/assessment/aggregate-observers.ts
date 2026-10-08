import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * The "others" profile is the **equal-weight average of each Observer's
 * individually-normalized Tribe scores** — not a pooled bag of words. Each
 * Observer's selection is scored on its own through the same normalized core the
 * Subject uses (`score`), then those per-observer profiles are averaged with
 * weight `1/N`. Because every Observer is reduced to one normalized profile and
 * each profile counts once, an Observer who picks more words gains no extra
 * influence over the shared view.
 *
 * This module is pure and carries no selection-range gating — that gate lives at
 * the persistence boundary (`observer/repository.ts`), which only ever writes
 * in-range responses. Here we faithfully average whatever responses we are given.
 *
 * `server-only`: it imports the scoring core, so the word→tribe mapping never
 * reaches the client (ADR-0009). Render consumers from server components only.
 */

/**
 * The minimum number of Observer responses before the comparison report unlocks
 * (ADR-0003). Below this the "others" view would be too thin to be meaningful and
 * individual Observers too easy to single out, so the report stays locked.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isComparisonUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

export interface ObserverAggregate {
  /**
   * The equal-weight average "others" profile — one normalized 0–1 score per
   * tribe, in canonical (tribe `number`) order, matching `score`'s ordering.
   */
  others: TribeScore[];
  /**
   * Each Observer's own individually-normalized profile, in response order, for
   * the anonymous per-observer drill-down (Observer 1 / 2 / 3 …). Carries no
   * Observer identity — just the scored word selection.
   */
  perObserver: TribeScore[][];
  /** How many Observer responses were aggregated. */
  count: number;
}

/**
 * Aggregate Observer word selections into the equal-weight "others" profile plus
 * the per-observer profiles for drill-down. Input is one word list per Observer;
 * the input is not mutated. With no responses the others profile is all-zero and
 * `count` is 0.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const count = perObserver.length;

  // Sum each tribe's individually-normalized score across observers, then divide
  // by the observer count — the equal-weight average. Keyed by slug so the result
  // can never drift from `score`'s per-tribe ordering.
  const summed: Record<string, number> = {};
  for (const tribe of tribes) summed[tribe.slug] = 0;
  for (const profile of perObserver) {
    for (const tribe of profile) summed[tribe.slug] += tribe.score;
  }

  const others: TribeScore[] = tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: count > 0 ? summed[tribe.slug] / count : 0,
  }));

  return { others, perObserver, count };
}
