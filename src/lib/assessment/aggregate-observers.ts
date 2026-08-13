import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight aggregation of 360 Observer responses into a single "others"
 * profile (issue #9, ADR-0003).
 *
 * Each Observer's selected words are scored *individually* with the same pure
 * scoring core the Subject uses, producing that Observer's normalized 0–1
 * per-tribe profile. The "others" profile is the **equal-weight average** of
 * those per-observer profiles — not the score of a pooled bag of everyone's
 * words. Averaging already-normalized profiles is what keeps an Observer who
 * picks 15 words from carrying more weight than one who picks 8: each Observer
 * contributes exactly one profile to the mean, regardless of how many words they
 * chose.
 *
 * The output is a `TribeScore[]` on the same 0–1 scale as `score()`, in the same
 * canonical (tribe `number`) order, so the comparison report can set it tribe-for
 * -tribe beside the Subject's own profile on one shared scale.
 *
 * `server-only`: this pulls in the scoring core (and through it the word→tribe
 * mapping), which must never reach the client (ADR-0009 trust boundary).
 */

/** How many Observer responses must exist before the comparison report unlocks. */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/**
 * Whether the self-vs-others comparison report may be shown, given how many
 * Observer responses have been recorded. The report stays locked below the
 * threshold so the "others" view is statistically meaningful and no individual
 * Observer can be singled out (ADR-0003).
 */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

/** The one field aggregation needs from an Observer response: its selected words. */
export interface ObserverResponseWords {
  words: readonly string[];
}

/**
 * Score one Observer's selected words into a normalized per-tribe profile — the
 * per-observer building block the aggregate averages and the report's anonymous
 * drill-down renders (Observer 1/2/3). A thin, named pass-through over `score`
 * so callers don't reach past this module into the scoring core.
 */
export function scoreObserver(response: ObserverResponseWords): TribeScore[] {
  return score(response.words);
}

/**
 * Aggregate Observer responses into the equal-weight "others" profile: the mean,
 * per tribe, of each Observer's individually-normalized score. With no responses
 * every tribe is 0. The result is in canonical order and on the 0–1 scale, so it
 * lines up tribe-for-tribe with the Subject's own `score()` output.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseWords[],
): TribeScore[] {
  const totals = new Map<string, number>();
  for (const tribe of tribes) totals.set(tribe.slug, 0);

  for (const response of responses) {
    for (const tribeScore of scoreObserver(response)) {
      totals.set(
        tribeScore.slug,
        (totals.get(tribeScore.slug) ?? 0) + tribeScore.score,
      );
    }
  }

  const count = responses.length;
  return tribes.map((tribe) => ({
    slug: tribe.slug,
    name: tribe.name,
    score: count > 0 ? (totals.get(tribe.slug) ?? 0) / count : 0,
  }));
}
