import "server-only";

import { getMarkerById } from "./markers";
import type {
  InterviewTurn,
  MarkerType,
  ScoreTraceEntry,
  TribeScoreTrace,
} from "./types";

/**
 * Builds the participant-facing score-trace (issue #21) from the server-side
 * Session's trace and Turns. It turns the persisted `ScoreTraceEntry[]` — which
 * cites Markers by id and answers by Turn index — into a per-tribe view-model
 * that resolves each cited Marker to its plain-language signal and each answer
 * to the question shown that Turn.
 *
 * `server-only` (ADR-0009): it reads the Marker Catalog, a scoring concern. The
 * *output* is a plain, client-safe data shape, but it is built here on the
 * server and only its resolved fields are ever rendered — the raw answer text,
 * Marker ids, and weights never cross the boundary (issue #21 criteria 3 & 4).
 */

/** Resolves a Marker id to the only two fields the trace exposes. */
type MarkerLookup = (
  id: string,
) => { type: MarkerType; signal: string } | undefined;

const defaultLookup: MarkerLookup = (id) => {
  const marker = getMarkerById(id);
  return marker ? { type: marker.type, signal: marker.signal } : undefined;
};

/**
 * Group the score trace by tribe, resolving every entry to a displayable
 * contribution (question shown → Marker signal → delta). Tribes are returned
 * strongest-first (ties broken by slug for determinism); contributions within a
 * tribe are oldest-first. Tribes with no contributions are omitted, and an entry
 * whose Marker no longer resolves is dropped rather than rendered as a blank
 * row — so `total` always equals the sum of what is actually shown.
 *
 * The answer is referenced by its Turn (`questionNumber` + the `question`
 * prompt), never copied, so the raw transcript stays out of the trace (issue
 * #10). The `lookup` is injected (defaulting to the real catalog) to keep this
 * pure and testable.
 */
export function buildTribeTraces(
  trace: readonly ScoreTraceEntry[],
  turns: readonly InterviewTurn[],
  lookup: MarkerLookup = defaultLookup,
): TribeScoreTrace[] {
  const byTribe = new Map<string, TribeScoreTrace>();

  for (const entry of trace) {
    // A clamped-to-zero contribution added no strength; showing a "+0" row is
    // noise, so it is omitted and `total` stays equal to what is displayed.
    if (entry.delta <= 0) continue;

    const marker = lookup(entry.markerId);
    if (!marker) continue;

    let group = byTribe.get(entry.tribeSlug);
    if (!group) {
      group = { tribeSlug: entry.tribeSlug, total: 0, contributions: [] };
      byTribe.set(entry.tribeSlug, group);
    }

    group.total += entry.delta;
    group.contributions.push({
      questionNumber: entry.turnIndex + 1,
      question: turns[entry.turnIndex]?.question ?? "",
      markerType: marker.type,
      signal: marker.signal,
      delta: entry.delta,
    });
  }

  for (const group of byTribe.values()) {
    group.contributions.sort((a, b) => a.questionNumber - b.questionNumber);
  }

  return [...byTribe.values()].sort(
    (a, b) => b.total - a.total || (a.tribeSlug < b.tribeSlug ? -1 : 1),
  );
}
