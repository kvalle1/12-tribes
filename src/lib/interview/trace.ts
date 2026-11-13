import "server-only";

import { getMarkerById } from "./markers";
import type {
  InterviewTurn,
  MarkerType,
  PostureSignal,
  ScoreTraceEntry,
} from "./types";

/**
 * Participant-facing score trace (slice 7, issue #21) — turns the raw
 * `ScoreTraceEntry` log into a per-tribe, human-readable view model the result
 * page can render, so the participant can see *why* each tribe scored
 * (ADR-0003 traceability), not just a bare percentage.
 *
 * Privacy (issue #10 is still open): a contribution is identified by the Turn
 * it came from and the *question* asked — never the participant's raw answer
 * text. The trace therefore stands on question → Marker → delta and can be
 * shown without exposing any free-text disclosure, honoring whichever way the
 * transcript-privacy decision lands rather than pre-committing it.
 *
 * `server-only` because it reads the Marker Catalog (ADR-0010), which never
 * reaches the client. The result page renders this view model to HTML
 * server-side, so no scoring internals beyond the intended trace cross the
 * ADR-0009 trust boundary.
 */

/** One applied delta, resolved for display. */
export interface TraceContribution {
  /** 1-based Turn number, for labels like "Answer 3". */
  turnNumber: number;
  /** The question the participant was answering — never their answer text. */
  question: string;
  markerId: string;
  /** The Marker's plain-language signal, or the id if the Marker is unknown. */
  signal: string;
  type: MarkerType;
  /** The applied (already clamped, non-negative) contribution to strength. */
  delta: number;
  postureSignal: PostureSignal;
}

/** Every contribution that scored toward one tribe, in Turn order. */
export interface TribeTrace {
  tribeSlug: string;
  /** Sum of the tribe's applied deltas (equal to its running strength). */
  total: number;
  contributions: TraceContribution[];
}

/**
 * Build the per-tribe score trace from the applied-delta log and the Turn
 * history. Tribes with no contributions are omitted (nothing to trace), and
 * the rest are ordered strongest-total first, ties broken by slug so the order
 * is deterministic. Contributions within a tribe stay in Turn order, as the
 * trace log is oldest-first.
 */
export function buildScoreTrace(
  trace: readonly ScoreTraceEntry[],
  turns: readonly InterviewTurn[],
): TribeTrace[] {
  const byTribe = new Map<string, TribeTrace>();

  for (const item of trace) {
    const contribution: TraceContribution = {
      turnNumber: item.turnIndex + 1,
      question: turns[item.turnIndex]?.question ?? "",
      markerId: item.markerId,
      signal: getMarkerById(item.markerId)?.signal ?? item.markerId,
      type: item.type,
      delta: item.delta,
      postureSignal: item.postureSignal,
    };

    const existing = byTribe.get(item.tribeSlug);
    if (existing) {
      existing.contributions.push(contribution);
      existing.total += item.delta;
    } else {
      byTribe.set(item.tribeSlug, {
        tribeSlug: item.tribeSlug,
        total: item.delta,
        contributions: [contribution],
      });
    }
  }

  return [...byTribe.values()].sort(
    (a, b) => b.total - a.total || (a.tribeSlug < b.tribeSlug ? -1 : 1),
  );
}
