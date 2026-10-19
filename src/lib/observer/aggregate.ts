import "server-only";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";

/**
 * The equal-weight 360 Observer aggregation (issue #9, ADR-0003) — the "others"
 * half of the self-vs-others comparison report.
 *
 * Each Observer's selection is scored on its own by the shared, normalized
 * scoring core (`score`, ADR-0001/0002), then the per-tribe scores are averaged
 * with **equal weight per Observer**: the mean of the individual normalized
 * profiles, never a pooled bag of everyone's words. An Observer who picks more
 * words therefore does not gain more influence — each counts once.
 *
 * `server-only`: it pulls in the scoring core, which carries the word→tribe
 * mapping and must never reach the client (ADR-0009). Aggregation runs on the
 * server; the client only ever receives the computed scores.
 */

/** One Observer's anonymous selection — just the words they chose. */
export interface ObserverResponseInput {
  readonly words: readonly string[];
}

export interface ObserverAggregate {
  /**
   * Equal-weight average normalized score per tribe, in canonical (tribe
   * `number`) order — the aggregated "others" profile.
   */
  average: TribeScore[];
  /**
   * Each Observer's own normalized scores, in canonical order, in the same order
   * as the input responses. Carries no identity — it is the only basis for the
   * anonymous "Observer 1/2/3" drill-down.
   */
  perObserver: TribeScore[][];
  /** How many Observers were aggregated (drives the unlock gate). */
  observerCount: number;
}

/**
 * Aggregate a Subject's Observer responses into an equal-weight "others"
 * profile. Returns an all-zero average (and no observers) for an empty set, so
 * callers can render a locked/empty state without special-casing.
 */
export function aggregateObservers(
  responses: readonly ObserverResponseInput[],
): ObserverAggregate {
  const perObserver = responses.map((r) => score(r.words));
  const observerCount = perObserver.length;

  const average: TribeScore[] = tribes.map((tribe, i) => {
    const total = perObserver.reduce((sum, one) => sum + one[i].score, 0);
    return {
      slug: tribe.slug,
      name: tribe.name,
      score: observerCount > 0 ? total / observerCount : 0,
    };
  });

  return { average, perObserver, observerCount };
}

/** A tribe's self score alongside the aggregated "others" score. */
export interface ProfileComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The aggregated "others" normalized score for this tribe. */
  others: number;
  /** `others − self`: positive where others see more, negative where they see less. */
  delta: number;
}

/**
 * Pair a self profile with an "others" profile tribe-by-tribe, in the self
 * profile's (canonical) order, attaching the signed `others − self` delta that
 * drives the alignment/divergence highlights. Pure: a tribe absent from the
 * others set is treated as zero. The inputs are not mutated.
 */
export function compareProfiles(
  self: readonly TribeScore[],
  others: readonly TribeScore[],
): ProfileComparisonRow[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));
  return self.map((s) => {
    const o = othersBySlug.get(s.slug) ?? 0;
    return { slug: s.slug, name: s.name, self: s.score, others: o, delta: o - s.score };
  });
}
