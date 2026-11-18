import "server-only";

import type {
  MarkerDelta,
  PostureLean,
  PostureProfile,
  PostureTally,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/** Resolves a tribe's oil-Marker id, or undefined if it has none. Injected so
 * the scoring engine stays catalog-free; `markers.oilMarkerForTribe` supplies
 * the real one in production. */
export type ResolveOilMarker = (tribeSlug: string) => string | undefined;

/**
 * Re-attribute a *matured* fall-line to its tribe's oil Marker (ADR-0004). A
 * fall-line Marker scored with an `integrated` Posture signal means the
 * participant resonates with the theme but describes having matured past the
 * dysfunction — evidence *of* the tribe, lived from the far side of the arc.
 * Such a delta keeps its full strength contribution but is cross-confirmed
 * through the tribe's oil Marker (a different Marker type) and pinned to the
 * integrated pole. Every other delta — an active or neutral fall-line, or any
 * non-fall-line — passes through unchanged. Pure; the oil-Marker lookup is
 * injected so this module holds no catalog.
 */
export function routeDelta(
  delta: MarkerDelta,
  resolveOilMarker: ResolveOilMarker,
): MarkerDelta {
  if (delta.type !== "fallLine" || delta.postureSignal !== "integrated") {
    return delta;
  }
  const oilMarkerId = resolveOilMarker(delta.tribeSlug);
  if (!oilMarkerId) return delta; // no oil Marker to route to: leave as-is
  return { ...delta, markerId: oilMarkerId, type: "oil", postureSignal: "integrated" };
}

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
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly MarkerDelta[],
  turnIndex: number,
  resolveOilMarker: ResolveOilMarker = () => undefined,
): { profile: StrengthProfile; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const raw of deltas) {
    // Matured fall-lines are routed to the oil Marker first (ADR-0004), so the
    // trace and Posture both reflect the cross-confirmed attribution.
    const delta = routeDelta(raw, resolveOilMarker);
    if (!Object.hasOwn(next, delta.tribeSlug)) continue;

    // Additive only: a contribution never lowers a tribe's strength.
    const applied = Math.max(0, delta.delta);
    next[delta.tribeSlug] += applied;

    trace.push({
      turnIndex,
      markerId: delta.markerId,
      tribeSlug: delta.tribeSlug,
      type: delta.type,
      delta: applied,
      postureSignal: delta.postureSignal,
    });
  }

  return { profile: next, trace };
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

/**
 * Aggregate the per-tribe Posture from the score trace (ADR-0004). Posture is a
 * first-class axis orthogonal to strength: it reads the same applied deltas but
 * sorts each one's strength magnitude into the arc bucket named by its
 * `postureSignal`, so a tribe can be strongly present *and* clearly integrated,
 * or present and still in its active shadow. Only tribes with evidence appear.
 *
 * Derived from the trace rather than stored separately, so it stays correct on
 * resume with no extra persisted state (the same approach `confidence.ts` takes
 * for its ranking history).
 */
export function aggregatePosture(trace: readonly ScoreTraceEntry[]): PostureProfile {
  const profile: PostureProfile = {};
  for (const entry of trace) {
    const tally = (profile[entry.tribeSlug] ??= {
      activeShadow: 0,
      integrated: 0,
      neutral: 0,
    });
    if (entry.postureSignal === "active-shadow") tally.activeShadow += entry.delta;
    else if (entry.postureSignal === "integrated") tally.integrated += entry.delta;
    else tally.neutral += entry.delta;
  }
  return profile;
}

/**
 * Read a tribe's arc position off its Posture tally: the dominant pole, or
 * `neutral` when the two poles tie or nothing posture-bearing scored. The
 * `neutral` bucket is deliberately not a pole — it records non-arc evidence
 * (plain strength) and never tips the lean on its own.
 */
export function postureLean(tally: PostureTally | undefined): PostureLean {
  if (!tally) return "neutral";
  if (tally.integrated > tally.activeShadow) return "integrated";
  if (tally.activeShadow > tally.integrated) return "active-shadow";
  return "neutral";
}
