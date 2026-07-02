import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of anonymous 360 Observer responses (issue #9,
 * ADR-0003). Given the words each Observer selected for a Subject, this builds
 * the "how others see you" profile: each Observer's selection is scored
 * *individually* with the same normalized scoring core the Subject uses, then
 * the per-tribe scores are averaged with **equal weight per Observer**.
 *
 * Equal-weight (rather than pooling every Observer's words into one bag) is the
 * whole point: an Observer who picks more words must not gain more influence
 * (ADR-0003). Because each Observer is normalized to 0–1 before averaging, word
 * count cancels out and every Observer counts once.
 *
 * Pure and dependency-free apart from the scoring core, so it is unit-testable
 * without the DB. It is `server-only` because it pulls in the word→tribe mapping
 * through `score`; the report page computes the profile server-side and passes
 * only plain numbers to the client (ADR-0009 trust boundary).
 */

export interface ObserverProfile {
  /** Anonymous, order-based label for per-observer drill-down ("Observer 1"…). */
  label: string;
  /** This Observer's individually-normalized 0–1 scores, per tribe (canonical order). */
  scores: TribeScore[];
}

export interface ObserversAggregate {
  /** Number of Observer responses aggregated. */
  count: number;
  /**
   * The equal-weight average of the per-Observer normalized scores, per tribe in
   * canonical (tribe `number`) order. All-zero when there are no responses.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized scores, anonymized and numbered in input
   * order, for the anonymous per-observer drill-down (Observer 1 / 2 / 3…).
   */
  observers: ObserverProfile[];
}

/**
 * Aggregate a Subject's Observer responses into the equal-weight "others"
 * profile. Each element of `responses` is one Observer's selected words; they
 * are scored independently and averaged with equal weight per Observer.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserversAggregate {
  const observers: ObserverProfile[] = responses.map((words, index) => ({
    label: `Observer ${index + 1}`,
    scores: score(words),
  }));

  const average: TribeScore[] = tribes.map((tribe) => {
    const total = observers.reduce((sum, observer) => {
      const tribeScore = observer.scores.find((s) => s.slug === tribe.slug);
      return sum + (tribeScore?.score ?? 0);
    }, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observers.length > 0 ? total / observers.length : 0,
    };
  });

  return { count: observers.length, average, observers };
}
