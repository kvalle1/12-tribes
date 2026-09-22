import "server-only";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  barsFromScores,
  hasEnoughObservers,
  MIN_OBSERVERS,
  sharedMaxScore,
} from "./aggregate";
import { getObserverResponses } from "./repository";

/**
 * Server-side builder for the 360 comparison report (issue #9). It runs all the
 * scoring — self and every Observer — on the server and hands the client only
 * finished per-tribe bar fractions, never the word→tribe mapping (ADR-0009). The
 * report unlocks only once at least `MIN_OBSERVERS` Observers have responded
 * (ADR-0003); below that the builder reports the locked state and the running
 * count so the UI can show progress toward the unlock.
 *
 * Bars for the Subject and for the "others" reads share **one scale**. The
 * scoring core already normalizes each tribe by its available points (ADR-0001),
 * so a tribe's score means the same thing for any reader; the report divides
 * every profile by a single shared max only to pick readable bar heights. It
 * deliberately does **not** re-normalize each profile against its own top tribe
 * (as the single-profile result view does), which would put self and others on
 * different denominators and turn the averaging's natural flattening into fake
 * divergence.
 */

/** Per-tribe bar fractions for one profile (self, aggregate, or one Observer). */
export interface ProfileBars {
  /** Anonymous label — "You", "All observers", or "Observer 1". */
  label: string;
  /**
   * Bar-fill fraction (0–1) keyed by tribe slug. Every one of the 12 tribes is
   * present. All profiles in a report are scaled by the same shared max, so a
   * given tribe's fractions are directly comparable across self and others.
   */
  relativeBySlug: Record<string, number>;
}

/** Display metadata for one tribe row, in the fixed self-ranking order. */
export interface ReportTribe {
  slug: string;
  name: string;
  /** Accent hex from the tribe's `color` (ADR: single source of truth). */
  accent: string;
}

export interface LockedReport {
  unlocked: false;
  observerCount: number;
  minObservers: number;
}

export interface UnlockedReport {
  unlocked: true;
  observerCount: number;
  minObservers: number;
  /** Tribes in a fixed order (the Subject's own ranking, highest first). */
  order: ReportTribe[];
  /** The Subject's own profile. */
  self: ProfileBars;
  /** The equal-weight aggregate across all Observers. */
  aggregate: ProfileBars;
  /** Each Observer individually, anonymous, in submission-independent order. */
  perObserver: ProfileBars[];
}

export type ComparisonReport = LockedReport | UnlockedReport;

/**
 * Build the comparison report for a Subject: score their own saved words and
 * every Observer response, aggregate the Observers with equal weight, and shape
 * it all into shared-scale bar fractions ordered by the Subject's own ranking so
 * "You" and "others" line up tribe-for-tribe. Returns the locked state (with the
 * running Observer count) until the unlock threshold is met.
 */
export async function buildComparisonReport(
  subjectId: string,
  selfWords: readonly string[],
): Promise<ComparisonReport> {
  const responses = await getObserverResponses(subjectId);
  const observerCount = responses.length;

  if (!hasEnoughObservers(observerCount)) {
    return { unlocked: false, observerCount, minObservers: MIN_OBSERVERS };
  }

  const selfScores = score(selfWords);
  const { averaged, perObserver } = aggregateObservers(responses);

  // One denominator across every profile shown, so bars stay comparable and the
  // Subject's bars don't jump when drilling into a single Observer.
  const sharedMax = sharedMaxScore([selfScores, averaged, ...perObserver]);

  const order: ReportTribe[] = [...selfScores]
    .sort((a, b) => b.score - a.score)
    .map((tribe) => ({
      slug: tribe.slug,
      name: tribe.name,
      accent: accentHex(getTribeBySlug(tribe.slug)?.color ?? ""),
    }));

  return {
    unlocked: true,
    observerCount,
    minObservers: MIN_OBSERVERS,
    order,
    self: { label: "You", relativeBySlug: barsFromScores(selfScores, sharedMax) },
    aggregate: {
      label: "All observers",
      relativeBySlug: barsFromScores(averaged, sharedMax),
    },
    perObserver: perObserver.map((table, i) => ({
      label: `Observer ${i + 1}`,
      relativeBySlug: barsFromScores(table, sharedMax),
    })),
  };
}
