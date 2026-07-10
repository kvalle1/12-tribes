import "server-only";

import { getMarkerById } from "./markers";
import type {
  ScoreDelta,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * Pure scoring engine for the Interview (slice #16).
 *
 * Given the running Strength Profile and the per-Marker deltas the agent found
 * in an answer, it folds those deltas into the profile and returns a trace entry
 * for each. Two invariants, straight from the ADRs:
 *
 * - **Marker-constrained (ADR-0003):** a delta only applies if it cites a real
 *   catalogued Marker whose `tribeSlug` matches — the agent can't score toward a
 *   tribe the Marker doesn't belong to.
 * - **Additive, never lowers strength (ADR-0004):** shadow/fall-line evidence is
 *   additive to strength like any other type; a negative or non-finite delta
 *   contributes 0 rather than subtracting. Maturity around a fall-line is
 *   evidence *of* the tribe, so it must never reduce the score.
 *
 * The module is pure and dependency-light (only the catalog lookup) so it can be
 * unit-tested without the LLM or the database.
 */

export interface ApplyResult {
  /** A new profile — the input is never mutated. */
  profile: StrengthProfile;
  /** One trace entry per applied delta, in input order. */
  trace: ScoreTraceEntry[];
}

/**
 * Fold cited-Marker deltas into a Strength Profile. `turnIndex` is stamped on
 * each trace entry so the result can point back to the answer that produced it.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly ScoreDelta[],
  turnIndex: number,
): ApplyResult {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const d of deltas) {
    const marker = getMarkerById(d.markerId);
    // Marker-constrained: unknown id, or a slug that doesn't match the cited
    // Marker, is dropped rather than trusted (ADR-0003).
    if (!marker || marker.tribeSlug !== d.tribeSlug) continue;

    // Additive only: never let a delta lower a tribe's strength (ADR-0004).
    const contribution = Number.isFinite(d.delta) && d.delta > 0 ? d.delta : 0;
    const before = next[d.tribeSlug] ?? 0;
    const after = before + contribution;
    next[d.tribeSlug] = after;

    trace.push({
      turnIndex,
      markerId: d.markerId,
      tribeSlug: d.tribeSlug,
      type: marker.type,
      delta: contribution,
      before,
      after,
      postureSignal: d.postureSignal,
    });
  }

  return { profile: next, trace };
}

/**
 * Display normalization: turn independent per-tribe strengths into percentage
 * shares that sum to 100 (ADR-0002 — the shares are cosmetic; the underlying
 * scores stay independent and must not be treated as mutually exclusive). An
 * all-zero profile yields all-zero shares rather than NaN.
 */
export function toPercentages(profile: StrengthProfile): Record<string, number> {
  const total = Object.values(profile).reduce(
    (sum, v) => sum + (v > 0 ? v : 0),
    0,
  );
  const out: Record<string, number> = {};
  for (const [slug, value] of Object.entries(profile)) {
    const positive = value > 0 ? value : 0;
    out[slug] = total > 0 ? (positive / total) * 100 : 0;
  }
  return out;
}
