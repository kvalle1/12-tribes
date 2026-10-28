import "server-only";

import { getMarkerById } from "./markers";
import type { MarkerType, PostureSignal, ScoreTraceEntry } from "./types";

/**
 * The score-trace view model (issue #21) — turns the server-side
 * `ScoreTraceEntry` log into a per-tribe, participant-facing explanation of
 * *why* each tribe scored as it did: which answer mapped to which Marker
 * produced which delta (ADR-0003 traceability).
 *
 * **Privacy (issue #10).** The transcript-privacy decision is still open, so
 * this takes the privacy-protective reading: the trace never renders the
 * participant's raw answer text. An answer is referenced positionally — by its
 * 1-based question number — and what it resonated with is shown as the Marker's
 * *authored catalog signal*, never the participant's own words. That keeps the
 * instrument defensible without pre-committing to exposing the transcript, and
 * it holds whichever way #10 lands.
 *
 * `server-only` (ADR-0009): the Marker Catalog is a scoring concern. This module
 * resolves `markerId → signal` on the server and the result page renders the
 * finished view model, so no catalog or scoring internals ship to the client.
 */

/** One applied delta, dressed for display: positional + catalog data only. */
export interface TraceContribution {
  /** The 1-based question this answer was given to (`turnIndex + 1`). */
  questionNumber: number;
  markerId: string;
  /** The authored Marker signal — never the participant's answer text. */
  markerSignal: string;
  type: MarkerType;
  delta: number;
  postureSignal: PostureSignal;
}

/** A tribe's score explained: its total and the contributions that built it. */
export interface TribeTrace {
  tribeSlug: string;
  total: number;
  contributions: TraceContribution[];
}

/**
 * Group a score trace into per-tribe explanations.
 *
 * With `slugs`, only those tribes are returned, in the given order (typically
 * the Primary + Contenders, strongest first) — tribes with no contributions are
 * dropped. Without `slugs`, every tribe that scored appears, strongest total
 * first with ties broken by slug. Contributions within a tribe are chronological.
 */
export function buildScoreTrace(
  trace: readonly ScoreTraceEntry[],
  slugs?: readonly string[],
): TribeTrace[] {
  const byTribe = new Map<string, TraceContribution[]>();

  for (const entry of trace) {
    const marker = getMarkerById(entry.markerId);
    const contribution: TraceContribution = {
      questionNumber: entry.turnIndex + 1,
      markerId: entry.markerId,
      // Authored signal only — a validation miss should never leak an id as
      // "signal", so fall back to neutral copy rather than exposing internals.
      markerSignal: marker?.signal ?? "Resonated with a signal in the Marker Catalog.",
      type: entry.type,
      delta: entry.delta,
      postureSignal: entry.postureSignal,
    };
    const existing = byTribe.get(entry.tribeSlug);
    if (existing) existing.push(contribution);
    else byTribe.set(entry.tribeSlug, [contribution]);
  }

  for (const contributions of byTribe.values()) {
    contributions.sort((a, b) => a.questionNumber - b.questionNumber);
  }

  const toTribeTrace = (slug: string): TribeTrace => {
    const contributions = byTribe.get(slug) ?? [];
    const total = contributions.reduce((sum, c) => sum + c.delta, 0);
    return { tribeSlug: slug, total, contributions };
  };

  if (slugs) {
    return slugs.map(toTribeTrace).filter((t) => t.contributions.length > 0);
  }

  return [...byTribe.keys()]
    .map(toTribeTrace)
    .sort((a, b) => b.total - a.total || (a.tribeSlug < b.tribeSlug ? -1 : 1));
}
