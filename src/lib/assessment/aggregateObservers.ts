import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored individually through the same
 * normalized scoring core the Self Assessment uses (`score`), yielding a 0–1
 * Strength Profile per Observer. The "others" profile is the **equal-weight
 * average** of those per-Observer profiles — the mean of each tribe's normalized
 * score across Observers — **not** a pooled bag of words. Because each
 * Observer's profile is normalized before averaging, an Observer who selects
 * more words does not gain more influence: every Observer is one equal voice
 * (PRD story 25).
 *
 * The module is pure and dependency-free (beyond the scoring core and the tribe
 * list), so it can be unit-tested without the LLM, the DB, or any Observer
 * identity. It is `server-only` because it pulls in the `server-only` scoring
 * core, which carries the word→tribe mapping that must never reach the client
 * (ADR-0009 trust boundary).
 */

/** The aggregated 360 "others" view plus the per-Observer profiles behind it. */
export interface ObserverAggregate {
  /** How many Observer responses were aggregated. */
  observerCount: number;
  /**
   * Equal-weight average per-tribe "others" profile, in canonical (tribe
   * `number`) order — the mean of each Observer's individually-normalized score.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in canonical order, one entry per
   * response in input order. Anonymous: an Observer is only ever an index here
   * (Observer 1, 2, 3…), never an identity — nothing links a profile back to who
   * submitted it (ADR-0003).
   */
  perObserver: TribeScore[][];
}

/**
 * The minimum number of Observer responses before the comparison report
 * unlocks. Below it the "others" view would be too thin to be meaningful and an
 * individual Observer's answers too easy to single out, so the report stays
 * locked (ADR-0003, PRD story 23).
 */
export const OBSERVER_REPORT_MINIMUM = 3;

/** Whether `count` Observer responses is enough to unlock the comparison report. */
export function isObserverReportUnlocked(count: number): boolean {
  return count >= OBSERVER_REPORT_MINIMUM;
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile. Each
 * response is a list of selected words (as stored on an `observer_response`
 * row). Returns the per-tribe average of the individually-normalized profiles,
 * the per-Observer profiles for anonymous drill-down, and the Observer count.
 * The input is not mutated.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  const others: TribeScore[] = tribes.map((tribe, index) => {
    const total = perObserver.reduce(
      (sum, profile) => sum + profile[index].score,
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, others, perObserver };
}
