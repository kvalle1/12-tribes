import "server-only";

import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import type {
  InterviewResult,
  RankedTribe,
  ScoredDelta,
  StrengthProfile,
  TraceEntry,
  TribeShare,
} from "./types";

/**
 * Pure Scoring engine for the AI Agent Interview (PRD #13, slice #16).
 *
 * The agent interprets a free-text answer and emits per-tribe deltas, each
 * citing a catalogued Marker. This module folds those cited deltas into the
 * running Strength Profile under three invariants:
 *
 *   • Cite-only (ADR-0003) — a delta counts only if its `markerId` resolves in
 *     the Marker Catalog, and the cited tribe/type must match the catalog entry.
 *     The catalog, not the agent, supplies the tribe and weight, so the agent
 *     can never invent a scoring rationale or mis-route a signal.
 *   • Additive, never subtractive (ADR-0004) — every Marker type (including
 *     shadow and fall-line) only ever *raises* a tribe's strength. Shadow and
 *     fall-line are bias-resistant evidence that you resonate with a tribe's
 *     wiring; they are not penalties.
 *   • Traceable — each applied contribution yields a trace entry pointing back
 *     at the answer that produced it and the Marker it cited, so the result can
 *     explain itself (PRD story 11) and scoring stays reproducible.
 *
 * Underlying scores stay independent and un-normalized; `toDisplayShares`
 * derives display percentages on demand (ADR-0002) so normalization never
 * mutates the accumulated state.
 *
 * `server-only` (ADR-0009/0010 trust boundary): the catalog and all scoring live
 * on the server. A client import is a build error.
 */

/** A delta's strength is clamped to this range before it is scaled by weight. */
export const MIN_DELTA = 0;
export const MAX_DELTA = 1;

function clampDelta(delta: number): number {
  if (typeof delta !== "number" || Number.isNaN(delta)) return 0;
  return Math.min(MAX_DELTA, Math.max(MIN_DELTA, delta));
}

/** A fresh, zeroed strength profile covering all 12 tribes. */
export function emptyStrengthProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  return profile;
}

export interface ApplyDeltasResult {
  /** The profile with the applicable contributions folded in (new object). */
  profile: StrengthProfile;
  /** One trace entry per applied contribution, in input order. */
  trace: TraceEntry[];
}

/**
 * Fold one answer's cited deltas into `profile`, returning a new profile and the
 * trace of what was applied. `turnIndex` is the index of the answer in the
 * Session's `turns` so each trace entry points back at its source answer.
 *
 * A delta is dropped (contributes nothing, produces no trace) when:
 *   • its `markerId` is not in the catalog (unknown / hallucinated cite),
 *   • its echoed `tribeSlug` or `type` disagrees with the catalog entry
 *     (mis-cite — the signal was routed to the wrong tribe), or
 *   • its clamped strength is 0 (nothing to add).
 *
 * The input profile is never mutated.
 */
export function applyDeltas(
  profile: StrengthProfile,
  turnIndex: number,
  deltas: readonly ScoredDelta[],
): ApplyDeltasResult {
  const next: StrengthProfile = { ...profile };
  const trace: TraceEntry[] = [];

  for (const delta of deltas) {
    const marker = getMarkerById(delta.markerId);
    if (!marker) continue; // cite-only: unknown id dropped
    // Mis-cite guard: the catalog is authoritative, so a delta that claims a
    // different tribe or type than the Marker it cites is dropped rather than
    // silently re-routed.
    if (delta.tribeSlug && delta.tribeSlug !== marker.tribeSlug) continue;
    if (delta.type && delta.type !== marker.type) continue;

    const strength = clampDelta(delta.delta);
    const contribution = marker.weight * strength;
    if (contribution <= 0) continue; // additive: nothing subtracts

    next[marker.tribeSlug] = (next[marker.tribeSlug] ?? 0) + contribution;
    trace.push({
      turnIndex,
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      contribution,
      postureSignal: delta.postureSignal,
    });
  }

  return { profile: next, trace };
}

/**
 * Project the raw profile onto display shares: each tribe's independent `score`
 * plus its `share` as a percentage of the whole (ADR-0002). Percentages are for
 * reading at a glance only; they are derived here and never stored, so the
 * underlying scores stay independent. Tribes are returned in canonical
 * (`number`) order.
 */
export function toDisplayShares(profile: StrengthProfile): TribeShare[] {
  const total = tribes.reduce((sum, t) => sum + (profile[t.slug] ?? 0), 0);
  return tribes.map((tribe) => {
    const score = profile[tribe.slug] ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      score,
      share: total > 0 ? (score / total) * 100 : 0,
    };
  });
}

/**
 * Rank tribes highest strength first, attaching the bar-fill fraction the result
 * view draws (`relative`: the score as a fraction of the top tribe's). Ties keep
 * canonical (`number`) order, so the ranking is deterministic. Input untouched.
 */
export function deriveRanking(profile: StrengthProfile): RankedTribe[] {
  const shares = toDisplayShares(profile);
  const ranked = [...shares].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;
  return ranked.map((tribe) => ({
    ...tribe,
    relative: max > 0 ? tribe.score / max : 0,
  }));
}

/** The derived result for a completed Interview: the full ranked profile. */
export function deriveInterviewResult(profile: StrengthProfile): InterviewResult {
  return { ranking: deriveRanking(profile) };
}
