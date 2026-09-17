import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of the 360 Observer responses (issue #9,
 * ADR-0003). The "how others see you" profile is the equal-weight average of
 * each Observer's individually-normalized tribe scores — **not** a pooled bag of
 * words — so an Observer who selects more words does not gain more influence.
 *
 * Each Observer's response is scored on its own with the same normalized core
 * the Subject's Self Assessment uses (`score`), then the per-tribe scores are
 * averaged across Observers. Reusing `score` verbatim keeps self and observer
 * profiles on the same 0–1 scale, so the comparison report can lay them side by
 * side.
 *
 * The module is `server-only` because it pulls in the word→tribe mapping via
 * `score`; the report page runs it on the server and hands the client only the
 * resulting `TribeScore[]` (slug/name/score — no mapping), which is safe to
 * render (ADR-0009 trust boundary).
 */

export interface ObserverAggregate {
  /**
   * Equal-weight average of the per-observer normalized scores, one entry per
   * tribe in canonical (tribe `number`) order. All-zero when there are no
   * responses.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized profile, in the order the responses were
   * given. Anonymous by construction — a profile carries only tribe scores,
   * nothing identifying the Observer — which is what the report's per-observer
   * drill-down ("Observer 1/2/3") renders.
   */
  perObserver: TribeScore[][];
  /** How many Observer responses were aggregated. */
  count: number;
}

/**
 * Aggregate a set of Observer responses (each a list of selected words) into the
 * equal-weight "others" profile plus the individual per-observer profiles.
 *
 * The input order is preserved in `perObserver`; callers that want stable
 * "Observer 1/2/3" labels should pass the responses in a stable order (e.g. by
 * creation time).
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const count = perObserver.length;

  // Sum each tribe's normalized score across observers, then divide by the
  // observer count — an equal-weight mean of normalized profiles.
  const totals: Record<string, number> = {};
  for (const tribe of tribes) totals[tribe.slug] = 0;
  for (const profile of perObserver) {
    for (const s of profile) totals[s.slug] += s.score;
  }

  const average: TribeScore[] = tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: count > 0 ? totals[tribe.slug] / count : 0,
  }));

  return { average, perObserver, count };
}
