import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). The "how others see you" profile is the **average of each
 * observer's individually-normalized tribe scores** — not a pooled bag of every
 * observer's words. Scoring each observer on their own first, then averaging,
 * means an observer who selects more words does not gain more influence: each
 * observer contributes exactly `1/N` of the others profile regardless of how
 * many words they picked.
 *
 * Reuses the pure Self scoring core (`score`) unchanged, so a self score and an
 * observer score are computed the same way and are directly comparable. Because
 * `score` is `server-only` (it pulls in the word→tribe mapping), this module is
 * too; the report renders on the server and sends only the resulting numbers to
 * the client.
 */

export interface ObserverAggregate {
  /** How many observers responded — drives the ≥3 unlock gate. */
  observerCount: number;
  /**
   * Equal-weight average per-tribe "others" profile, in canonical (tribe
   * `number`) order — the same shape and order as a Self `score()` result, so
   * the two can be compared tribe-for-tribe.
   */
  others: TribeScore[];
  /**
   * Each observer's own individually-normalized scores, in canonical order, one
   * entry per response in input order. Positional and fully anonymous — the
   * report labels these "Observer 1 / 2 / 3" and never attaches any identity.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate a Subject's observer responses (each an array of selected words)
 * into the equal-weight "others" profile plus the per-observer breakdown. An
 * empty set yields an all-zero others profile and no per-observer entries
 * (never divides by zero).
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  // `score` always returns the 12 tribes in canonical order, so index `i`
  // lines up with `tribes[i]` across every observer — average tribe-by-tribe.
  const others: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, s) => sum + s[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { observerCount, others, perObserver };
}
