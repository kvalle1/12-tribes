import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * Equal-weight "how others see you" aggregation for the 360 flow (issue #9,
 * ADR-0003). Given each Observer's selected words, score every Observer
 * *individually* with the same normalized scoring core the Self flow uses, then
 * return the **equal-weight average** of those per-observer profiles.
 *
 * Averaging normalized per-observer scores (rather than pooling everyone's words
 * into one bag) is the whole point: an Observer who selects more words does not
 * gain more influence over the result. Each Observer's profile is already
 * coverage-normalized to 0–1 by `score`, so the mean is a fair "others" profile
 * on the same scale as the Subject's own.
 *
 * `server-only` because it pulls in the word→tribe mapping through `score`
 * (ADR-0009 trust boundary); the report page renders it from the server.
 */

/**
 * The comparison report unlocks only once at least this many Observers have
 * responded (ADR-0003). Below it the average isn't meaningful and, just as
 * importantly, a per-observer drill-down with one or two responses would thin
 * out the anonymity the whole 360 depends on.
 */
export const MIN_OBSERVERS_TO_UNLOCK = 3;

/** Whether enough Observers have responded to unlock the comparison report. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_TO_UNLOCK;
}

/**
 * The equal-weight average of each Observer's individually-normalized tribe
 * scores, returned for all 12 tribes in canonical (tribe `number`) order so it
 * lines up with `score(...)` for a side-by-side comparison. With no responses
 * every tribe is 0. Unknown words and within-observer duplicates are handled by
 * the scoring core, so callers can pass stored rows' raw `words` directly.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const count = responses.length;

  // Score each Observer on their own, keyed by slug so the mean never depends on
  // array ordering.
  const perObserver = responses.map((words) => {
    const byslug = new Map<string, number>();
    for (const s of score(words)) byslug.set(s.slug, s.score);
    return byslug;
  });

  return tribes.map((tribe) => {
    const sum = perObserver.reduce(
      (acc, byslug) => acc + (byslug.get(tribe.slug) ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: count > 0 ? sum / count : 0,
    };
  });
}
