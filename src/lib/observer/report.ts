import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { observerResponses } from "@/db/schema";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  scoreEachObserver,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregate-observers";

/**
 * Server-only assembly of the self-vs-others comparison report (issue #9). Loads
 * the Subject's saved current result and their anonymous Observer responses,
 * scores both with the shared normalized core, and returns everything the report
 * view needs. The `server-only` import keeps the word→tribe mapping (pulled in
 * through the scoring core) off the client.
 *
 * The "others" aggregate and per-observer drill-down are computed **only when
 * the report is unlocked** (≥ `MIN_OBSERVERS` responses). Below the threshold
 * nothing about the responses is returned — not even a peek at a single early
 * Observer — so anonymity holds until the pool is large enough (ADR-0003).
 */

export interface ComparisonReport {
  self: {
    words: string[];
    primarySlug: string;
    secondarySlug: string | null;
    /** The Subject's own normalized 12-tribe profile (canonical order). */
    scores: TribeScore[];
  };
  /** How many Observers have responded so far. */
  observerCount: number;
  /** The minimum needed to unlock the comparison (for the locked-state copy). */
  minObservers: number;
  /** Whether the "others" comparison is unlocked (≥ minObservers). */
  unlocked: boolean;
  /** Present only when `unlocked`. */
  others?: {
    /** Equal-weight "others" profile (canonical order), comparable to `self.scores`. */
    average: TribeScore[];
    /**
     * Each Observer's own normalized profile, oldest-first, for the anonymous
     * per-observer drill-down (Observer 1/2/3…). Carries no identity — position
     * is the only label.
     */
    perObserver: TribeScore[][];
  };
}

/**
 * Build the comparison report for a Subject, or `null` if they have no saved
 * result yet (in which case there is nothing to compare against and the caller
 * should route them to take the assessment).
 */
export async function getComparisonReport(
  subjectUserId: string,
): Promise<ComparisonReport | null> {
  const self = await getCurrentResult(subjectUserId);
  if (!self) return null;

  // Oldest-first so the anonymous Observer numbering is stable across visits.
  const rows = await db
    .select({ words: observerResponses.words })
    .from(observerResponses)
    .where(eq(observerResponses.subjectId, subjectUserId))
    .orderBy(asc(observerResponses.createdAt));

  const responses = rows.map((row) => row.words);
  const observerCount = responses.length;
  const unlocked = isReportUnlocked(observerCount);

  return {
    self: {
      words: self.words,
      primarySlug: self.primarySlug,
      secondarySlug: self.secondarySlug,
      scores: score(self.words),
    },
    observerCount,
    minObservers: MIN_OBSERVERS,
    unlocked,
    ...(unlocked
      ? {
          others: {
            average: aggregateObservers(responses),
            perObserver: scoreEachObserver(responses),
          },
        }
      : {}),
  };
}
