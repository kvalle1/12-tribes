import "server-only";

import { oilMarkerFor } from "./markers";
import type {
  MarkerDelta,
  PostureProfile,
  PosturePosition,
  PostureTally,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * The Scoring engine (ADR-0002/0003/0004) — pure, deterministic functions that
 * fold validated Marker deltas into a Strength Profile and normalize it for
 * display. It holds no catalog and makes no model call: `agent.ts` turns an
 * answer into validated, catalog-bounded deltas, and this module applies them.
 * Keeping it pure is what makes the instrument's scoring testable and
 * reproducible run-to-run.
 *
 * `server-only` keeps the scoring logic off the client (ADR-0009): a Strength
 * Profile is an authoritative result, never something the client computes.
 */

/**
 * Fold a Turn's validated deltas into the running profile, returning a new
 * profile (no mutation) and the trace entries for the applied deltas.
 *
 * The underlying scores are independent per-tribe tallies (ADR-0002): a delta
 * accumulates onto its tribe and touches no other. Two rules protect the
 * strength signal:
 *
 *  - **Additive, never subtractive (ADR-0004).** Every contribution raises
 *    strength or leaves it unchanged. A shadow or fall-line Marker fires on
 *    *resonance with the theme*, so maturity around a fall-line is still
 *    evidence *of* the tribe — a negative delta (anyone "fixing" the confound
 *    by subtracting) is clamped to zero rather than lowering strength.
 *  - **Known tribes only.** A delta whose `tribeSlug` is not already a key of
 *    the profile is a validation miss; it is dropped rather than inventing a
 *    new tribe.
 *
 * **Matured fall-line routing (ADR-0004).** A fall-line Marker scored with an
 * `integrated` posture signal is a *matured* fall-line: the person resonates
 * with the theme but has grown past its dysfunction, and the mature expression
 * of a fall-line theme is precisely the tribe's `oil`. So its trace entry is
 * re-attributed to the tribe's oil Marker — cross-confirming the attribution
 * through a different Marker type — while the strength it carries lands on the
 * tribe exactly once, unchanged. Re-attribution (not an extra contribution)
 * keeps the invariant the Confidence evaluator relies on: the trace's deltas
 * per tribe still sum to the profile, so `profileHistory` can replay it. The
 * oil Marker is resolved via `resolveOilMarker` (defaulting to the catalog) so
 * the engine stays unit-testable with a stub resolver; when a tribe has no oil
 * Marker, the original citation is kept.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly MarkerDelta[],
  turnIndex: number,
  resolveOilMarker: (tribeSlug: string) => string | undefined = oilMarkerFor,
): { profile: StrengthProfile; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
    if (!Object.hasOwn(next, delta.tribeSlug)) continue;

    // Additive only: a contribution never lowers a tribe's strength.
    const applied = Math.max(0, delta.delta);
    next[delta.tribeSlug] += applied;

    // Route a matured fall-line to the tribe's oil Marker, if one exists.
    const matured = delta.type === "fallLine" && delta.postureSignal === "integrated";
    const oilMarkerId = matured ? resolveOilMarker(delta.tribeSlug) : undefined;

    trace.push({
      turnIndex,
      markerId: oilMarkerId ?? delta.markerId,
      tribeSlug: delta.tribeSlug,
      type: oilMarkerId ? "oil" : delta.type,
      delta: applied,
      postureSignal: delta.postureSignal,
    });
  }

  return { profile: next, trace };
}

/**
 * Accumulate the per-tribe Posture tallies from a score trace (ADR-0004, slice
 * 6). Posture is the second axis every scored Marker feeds, orthogonal to
 * strength: each contribution's `postureSignal` moves the tribe toward one end
 * of its fall→oil arc, weighted by the contribution's `delta`. `neutral`
 * contributions move neither end but still register the tribe (so a tribe with
 * evidence but no posture read appears at zero rather than vanishing).
 *
 * Derived from the trace rather than stored separately, exactly like
 * `profileHistory`: the trace is the persisted source of truth, so Posture
 * needs no extra column and old Sessions project correctly too.
 */
export function accumulatePosture(
  trace: readonly ScoreTraceEntry[],
): PostureProfile {
  const posture: PostureProfile = {};
  for (const entry of trace) {
    const tally = (posture[entry.tribeSlug] ??= { activeShadow: 0, integrated: 0 });
    if (entry.postureSignal === "integrated") tally.integrated += entry.delta;
    else if (entry.postureSignal === "active-shadow") tally.activeShadow += entry.delta;
  }
  return posture;
}

/** A tribe leaning further than this from centre reads as one end of the arc. */
export const POSTURE_ARC_THRESHOLD = 0.33;

/**
 * Place a tribe's Posture tally on its fall→oil arc. `score` is the net lean,
 * -1 (fully active-shadow) to +1 (fully integrated); `arc` buckets it. A tribe
 * with no posture-bearing evidence has no position (`null`) rather than a
 * misleading centre reading.
 */
export function posturePosition(tally: PostureTally): PosturePosition | null {
  const total = tally.activeShadow + tally.integrated;
  if (total === 0) return null;
  const score = (tally.integrated - tally.activeShadow) / total;
  const arc =
    score > POSTURE_ARC_THRESHOLD
      ? "integrated"
      : score < -POSTURE_ARC_THRESHOLD
        ? "active-shadow"
        : "mixed";
  return { arc, score };
}

/**
 * Project the independent per-tribe scores onto display percentages that sum to
 * 100. This is cosmetic (ADR-0002): the scores are not a probability
 * distribution and remain independent underneath — normalization is only for
 * rendering shares. When nothing has scored yet every tribe is 0%, and the
 * total of zero is handled without dividing by zero.
 */
export function normalize(profile: StrengthProfile): Record<string, number> {
  const total = Object.values(profile).reduce((sum, score) => sum + score, 0);
  const pct: Record<string, number> = {};
  for (const [slug, score] of Object.entries(profile)) {
    pct[slug] = total === 0 ? 0 : (score / total) * 100;
  }
  return pct;
}
