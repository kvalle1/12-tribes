import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Pure equal-weight aggregation of 360 Observer responses (issue #9, ADR-0003).
 *
 * Each Observer is scored individually with the same normalized scoring core the
 * Self Assessment uses ({@link score}) — so an Observer's profile is already
 * coverage-normalized (ADR-0001). The "others" profile is then the **equal-weight
 * average** of those per-observer profiles: every Observer contributes exactly
 * `1/N`, so an Observer who selects more words gains no extra influence (PRD
 * story 25). This is deliberately *not* a pooled bag of words — pooling every
 * Observer's words into one selection and scoring once would let a talkative
 * Observer dominate.
 *
 * The module is pure and dependency-free (no DB, no request state) so it can be
 * unit-tested directly and reused by the comparison report. It carries
 * `server-only` transitively via {@link score}, so it must not reach the client.
 */

export interface ObserverAggregate {
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
  /**
   * Whether the comparison report should unlock. The report stays locked until
   * at least {@link MIN_OBSERVERS_TO_UNLOCK} Observers have responded, so the
   * "others" view is meaningful and no single Observer can be singled out.
   */
  unlocked: boolean;
  /**
   * The equal-weight average normalized score per tribe, in canonical (tribe
   * `number`) order — the aggregate "others" profile.
   */
  others: TribeScore[];
  /**
   * Each Observer's own normalized profile, in canonical order, in response
   * order (oldest first). Anonymous by construction: the array index is the only
   * identifier, surfaced to the Subject as "Observer 1", "Observer 2", … with no
   * attributes attached (ADR-0003).
   */
  perObserver: TribeScore[][];
}

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003) — enough that the "others" view is meaningful and
 * individual Observers stay anonymous.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/**
 * Aggregate anonymous Observer responses into an "others" profile. Scores each
 * Observer individually and returns the equal-weight per-tribe average plus each
 * Observer's individual profile for anonymous drill-down. Safe for zero
 * responses (returns an all-zero, locked aggregate).
 */
export function aggregateObservers(
  responses: readonly { words: readonly string[] }[],
): ObserverAggregate {
  const perObserver = responses.map((response) => score(response.words));
  const observerCount = perObserver.length;

  // score() returns tribes in canonical order, so every per-observer profile is
  // index-aligned to `tribes` — averaging position by position is well-defined.
  const others: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, profile) => sum + profile[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return {
    observerCount,
    unlocked: observerCount >= MIN_OBSERVERS_TO_UNLOCK,
    others,
    perObserver,
  };
}
