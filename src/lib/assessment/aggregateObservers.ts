import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight 360 Observer aggregation (issue #9, ADR-0003) — the "others"
 * half of the self-vs-others comparison report.
 *
 * Each Observer's response is scored *individually* by the same normalized
 * scoring core the Self Assessment uses (`score`), then the per-tribe scores are
 * averaged across Observers. Averaging normalized profiles — rather than pooling
 * everyone's words into one bag — is what makes the aggregation equal-weight: an
 * Observer who picks 15 words counts exactly as much as one who picks 8, so no
 * single Observer dominates the "others" view (PRD story 25).
 *
 * Like `score`, this is a pure, `server-only` module: the word→tribe mapping it
 * pulls in via `score` never reaches the client, and the report component runs
 * it server-side and passes only the resulting numbers down.
 */

/**
 * The minimum number of Observer responses before the comparison report
 * unlocks. Below this the "others" view would be too thin to be meaningful and
 * individual Observers could be de-anonymized, so the report stays locked
 * (ADR-0003, PRD story 23). A tunable constant.
 */
export const MIN_OBSERVERS_FOR_REPORT = 3;

/** Whether enough Observers have responded for the comparison report to unlock. */
export function isReportUnlocked(observerCount: number): boolean {
  return observerCount >= MIN_OBSERVERS_FOR_REPORT;
}

/**
 * The equal-weight "others" profile: score every Observer response on its own
 * (normalized), then take the plain per-tribe mean across all responses.
 * Returns a normalized 0–1 score for every tribe in canonical (tribe `number`)
 * order, matching `score`'s output shape so the report can treat self and others
 * identically. With no responses, every tribe scores 0.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  const perObserver = responses.map(
    (words) => new Map(score(words).map((s) => [s.slug, s.score])),
  );
  const observerCount = perObserver.length;

  return tribes.map((tribe) => {
    const sum = perObserver.reduce(
      (acc, scores) => acc + (scores.get(tribe.slug) ?? 0),
      0,
    );
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? sum / observerCount : 0,
    };
  });
}

/**
 * One tribe's side-by-side reading in the comparison report: the Subject's own
 * normalized score, the equal-weight "others" score, and the signed gap between
 * them (`self - others`). A positive `delta` means the Subject rates that tribe
 * in themselves more strongly than others do; a negative `delta` means others
 * see it more strongly than the Subject does — the divergences are where the
 * useful insight lives.
 */
export interface ProfileComparison {
  slug: string;
  name: string;
  /** The Subject's own normalized 0–1 score. */
  self: number;
  /** The equal-weight "others" normalized 0–1 score. */
  others: number;
  /** `self - others`. */
  delta: number;
}

/**
 * Pair a self profile against an "others" profile tribe-by-tribe, in the self
 * profile's (canonical) order. A tribe absent from `others` is treated as 0 so
 * the two profiles always align. Pure — takes already-computed scores and does
 * no scoring itself.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparison[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  return self.map((s) => {
    const otherScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: otherScore,
      delta: s.score - otherScore,
    };
  });
}
