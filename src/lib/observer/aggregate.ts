import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight aggregation of the anonymous 360 Observer responses for a Subject
 * (issue #9, ADR-0003). This is the "others" half of the comparison report: the
 * pure deep module that turns many Observer word-selections into one "how others
 * see you" profile, reusing the same scoring core (`score`) as the Self flow so
 * self and observer scores are directly comparable.
 *
 * The key decision (ADR-0003) is **equal-weight**: each Observer's selection is
 * scored and normalized individually first, then those per-observer 0–1 profiles
 * are averaged with one vote each. An Observer who picks more words therefore
 * gains no extra influence — the opposite of pooling everyone's words into one
 * bag and scoring that, where a prolific Observer would dominate.
 *
 * `server-only`: this pulls in `score`, which carries the word→tribe mapping, so
 * it must never reach the client (ADR-0009). The report page is a server
 * component that calls this and passes only the computed numbers to the view.
 */
export interface ObserverAggregate {
  /** How many Observer responses fed the aggregate (drives the unlock gate). */
  observerCount: number;
  /**
   * The equal-weight "others" profile: the mean of each Observer's individually
   * normalized tribe scores, in canonical (tribe `number`) order.
   */
  scores: TribeScore[];
  /**
   * Each Observer's own normalized profile, in input order, for the anonymous
   * per-observer drill-down (Observer 1 / 2 / 3…). Each vector is in canonical
   * order. Carries no identity — just the scored selection.
   */
  perObserver: TribeScore[][];
}

/**
 * Aggregate Observer responses (each an array of selected words) into the
 * equal-weight "others" profile plus the per-observer breakdown. With no
 * responses the scores are all zero and `perObserver` is empty. Scoring delegates
 * to `score`, so unknown words and duplicates within one response are ignored —
 * an Observer can't inflate their own weight by repeating a word.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): ObserverAggregate {
  const perObserver = responses.map((words) => score(words));
  const observerCount = perObserver.length;

  // Sum each tribe across observers by slug, so the average never leans on the
  // column order `score` happens to emit (it is canonical, but we join
  // explicitly — matching `compareProfiles` — rather than trust the position).
  const totalBySlug: Record<string, number> = {};
  for (const observer of perObserver) {
    for (const s of observer) {
      totalBySlug[s.slug] = (totalBySlug[s.slug] ?? 0) + s.score;
    }
  }

  const scores: TribeScore[] = tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: observerCount > 0 ? (totalBySlug[tribe.slug] ?? 0) / observerCount : 0,
  }));

  return { observerCount, scores, perObserver };
}
