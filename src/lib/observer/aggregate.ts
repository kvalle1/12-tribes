import { score, type TribeScore } from "@/lib/assessment/score";
import { tribes } from "@/lib/tribes";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003).
 *
 * The "how others see you" profile is the equal-weight average of each
 * observer's *individually-normalized* tribe scores — **not** a pooled bag of
 * words. Each observer's words are scored on their own through the shared
 * scoring core (`score`, the same normalized 0–1 profile the Self flow uses),
 * and only then averaged. This is the whole point of ADR-0003: an observer who
 * selects more words must not gain more influence, so effort (word count) never
 * becomes weight. Pooling every observer's words into one selection would let
 * the most prolific observer dominate; averaging normalized profiles gives each
 * observer exactly one equal vote.
 *
 * The comparison report unlocks only once at least `MIN_OBSERVERS` observers
 * have responded (ADR-0003) — that both makes the average meaningful and keeps
 * any individual observer unidentifiable in the aggregate.
 *
 * Pure and dependency-free apart from the scoring core, so it is unit-testable
 * in isolation. It transitively imports the `server-only` scoring core, so it
 * runs server-side only (ADR-0009) — never render it from the client.
 */

/** The report stays locked until at least this many observers have responded. */
export const MIN_OBSERVERS = 3;

export interface ObserverAggregate {
  /** How many observer responses were aggregated. */
  observerCount: number;
  /** Whether the comparison unlocks (`observerCount >= MIN_OBSERVERS`). */
  unlocked: boolean;
  /**
   * The equal-weight average "others" profile: for each tribe, the mean of that
   * tribe's normalized score across all observers. Canonical (tribe `number`)
   * order, one entry per tribe. All-zero when there are no observers.
   */
  others: TribeScore[];
  /**
   * Each observer's own normalized profile, in input order so the report can
   * label them anonymously and positionally (Observer 1, Observer 2, …). Never
   * carries observer identity — only their scored words.
   */
  perObserver: TribeScore[][];
}

/** A zeroed profile for every tribe in canonical order. */
function zeroProfile(): TribeScore[] {
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: 0,
  }));
}

/**
 * Aggregate observer responses into the equal-weight "others" profile plus each
 * observer's individual profile. `responses` is the list of each observer's
 * selected words (already validated on the way in by the repository); an empty
 * list yields an all-zero, locked aggregate.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  if (observerCount === 0) {
    return {
      observerCount: 0,
      unlocked: false,
      others: zeroProfile(),
      perObserver: [],
    };
  }

  // Average by tribe position. Every `score()` result lists the twelve tribes
  // in the same canonical order, so index `i` refers to the same tribe in every
  // observer's profile.
  const others = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, profile) => sum + profile[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: total / observerCount,
    };
  });

  return {
    observerCount,
    unlocked: observerCount >= MIN_OBSERVERS,
    others,
    perObserver,
  };
}
