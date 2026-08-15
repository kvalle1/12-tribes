import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). Given each Observer's selected words, it scores every Observer
 * *individually* with the shared, normalized scoring core (`score`) and returns
 * the **equal-weight average** of those per-Observer profiles — the "how others
 * see you" side of the comparison report.
 *
 * Two deliberate properties, both from ADR-0003:
 *
 * - **Not a pooled bag of words.** We never concatenate everyone's words and
 *   score once. Each Observer is normalized on their own, then the profiles are
 *   averaged. So an Observer who picks more words gains no extra influence — one
 *   Observer, one equal vote.
 * - **Anonymous drill-down.** Each Observer's profile is returned under a bare
 *   1-based `index` (Observer 1, 2, 3…) with no name, relationship, or any other
 *   attribute, so the spread of opinion is visible without identifying anyone.
 *
 * Reuses `score` unchanged, so the "others" profile is directly comparable to
 * the Subject's own Self Assessment profile. `server-only`, like the scoring
 * core it wraps: the word→tribe mapping never reaches the client (ADR-0009).
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below the threshold the average isn't meaningful and an
 * individual Observer could be identifiable, so the report stays locked.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** One Observer's normalized profile, labelled anonymously for drill-down. */
export interface ObserverProfile {
  /** 1-based anonymous label (Observer 1, 2, 3…), in submission order. */
  index: number;
  /** This Observer's individually-normalized 0–1 scores, canonical tribe order. */
  scores: TribeScore[];
}

export interface ObserverAggregate {
  /** How many Observer responses fed the aggregate. */
  observerCount: number;
  /** Whether the comparison report is unlocked (≥ MIN_OBSERVERS_TO_UNLOCK). */
  unlocked: boolean;
  /**
   * The equal-weight "others" profile: the per-tribe mean of the Observers'
   * individually-normalized scores, in canonical (tribe `number`) order. All
   * zeros when there are no responses.
   */
  others: TribeScore[];
  /** Per-Observer normalized profiles for anonymous drill-down. */
  perObserver: ObserverProfile[];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile plus the anonymous per-Observer profiles. Responses are taken in the
 * order given (typically oldest-first), which fixes the Observer 1/2/3 labels.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver: ObserverProfile[] = responses.map((words, i) => ({
    index: i + 1,
    scores: score(words),
  }));

  const others: TribeScore[] = tribes.map((tribe) => {
    const total = perObserver.reduce((sum, observer) => {
      const tribeScore = observer.scores.find((s) => s.slug === tribe.slug);
      return sum + (tribeScore?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: perObserver.length > 0 ? total / perObserver.length : 0,
    };
  });

  return {
    observerCount: perObserver.length,
    unlocked: perObserver.length >= MIN_OBSERVERS_TO_UNLOCK,
    others,
    perObserver,
  };
}
