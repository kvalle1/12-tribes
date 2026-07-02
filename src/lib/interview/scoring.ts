import "server-only";

import { tribes } from "@/lib/tribes";
import {
  getMarkerById,
  markerCatalog,
  type Marker,
} from "./markers";
import type {
  AppliedDelta,
  InterviewResult,
  ScoredDelta,
  StrengthProfile,
  TribeShare,
} from "./types";

/**
 * Pure Scoring engine for the AI Agent Interview (issue #16; ADR-0002/0003/0004).
 *
 * The agent scores by **citing catalogued Markers** — it may not invent
 * rationale (ADR-0003). This module takes those cited deltas, validates each
 * against the Marker Catalog, and folds them into a running Strength Profile.
 * The rigor lives here and in the catalog, not in the prompt: the delta's
 * contribution is `catalogued weight × the agent's [0,1] evidence strength`, so
 * a hallucinated weight or an uncatalogued Marker can never inflate a score.
 *
 * Two invariants a future reader must preserve (ADR-0004):
 *  - **Every Marker type is additive to strength.** Shadow and fall-line Markers
 *    raise a tribe's strength just like `strength`/`oil` ones — resonance with a
 *    tribe's shadow is evidence *of* that tribe. Nothing here ever subtracts.
 *  - **Scores are independent.** One tribe scoring high never lowers another.
 *    The percentages in `toDisplayShares` are cosmetic, computed on demand.
 *
 * The Posture axis (ADR-0004) and the Confidence/Stop evaluator that derives
 * Primary + Contenders / Co-Primaries (ADR-0006) are later slices; here Primary
 * is simply the top-scoring tribe. The module is pure and dependency-light so it
 * can be unit-tested without the LLM or the DB.
 */

/** A fresh, zeroed Strength Profile covering all 12 tribes, keyed by slug. */
export function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  return profile;
}

/** Clamp the agent's evidence strength into the [0, 1] the contract promises. */
function clampDelta(delta: number): number {
  if (typeof delta !== "number" || Number.isNaN(delta)) return 0;
  if (delta < 0) return 0;
  if (delta > 1) return 1;
  return delta;
}

export interface ApplyResult {
  /** The profile after folding in the applied deltas (a new object). */
  profile: StrengthProfile;
  /** The deltas that resolved against the catalog, with their contributions. */
  applied: AppliedDelta[];
}

/**
 * Fold a set of cited Marker deltas into a Strength Profile, returning a new
 * profile and the trace of what was applied. A delta is applied only when its
 * `markerId` resolves in the catalog **and** its cited `tribeSlug`/`type` match
 * the catalogued Marker (the agent must cite correctly — no ad-hoc scoring,
 * ADR-0003); mismatched or unknown deltas are dropped, never applied.
 *
 * The contribution is `weight × clampedDelta` and is always ≥ 0, so no Marker —
 * shadow or fall-line included — can lower a tribe's strength (ADR-0004).
 *
 * `catalog`/`resolve` are injectable so tests can exercise deliberately-broken
 * or minimal catalogs without touching the authored one.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly ScoredDelta[],
  resolve: (id: string) => Marker | undefined = getMarkerById,
): ApplyResult {
  const next: StrengthProfile = { ...profile };
  const applied: AppliedDelta[] = [];

  for (const cited of deltas) {
    const marker = resolve(cited.markerId);
    if (!marker) continue; // uncatalogued id — never trust it
    if (marker.tribeSlug !== cited.tribeSlug || marker.type !== cited.type) {
      continue; // agent mis-cited the Marker — drop rather than apply
    }

    const delta = clampDelta(cited.delta);
    const contribution = marker.weight * delta;
    next[marker.tribeSlug] = (next[marker.tribeSlug] ?? 0) + contribution;

    applied.push({
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      weight: marker.weight,
      delta,
      contribution,
      postureSignal:
        typeof cited.postureSignal === "number" && !Number.isNaN(cited.postureSignal)
          ? Math.max(-1, Math.min(1, cited.postureSignal))
          : 0,
    });
  }

  return { profile: next, applied };
}

/**
 * Project a Strength Profile onto display shares — each tribe's percent of the
 * total scored strength — ranked high to low. This is **cosmetic** (ADR-0002):
 * the underlying scores stay independent and are carried through unchanged. When
 * nothing has scored yet every share is 0.
 */
export function toDisplayShares(profile: StrengthProfile): TribeShare[] {
  const total = tribes.reduce((sum, t) => sum + (profile[t.slug] ?? 0), 0);
  const shares = tribes.map((tribe) => {
    const score = profile[tribe.slug] ?? 0;
    return {
      slug: tribe.slug,
      name: tribe.name,
      score,
      percent: total > 0 ? (score / total) * 100 : 0,
    };
  });
  // Rank by score desc; ties keep canonical (tribe `number`) order.
  return shares.sort((a, b) => b.score - a.score);
}

/** Build the completed-Session result from a Strength Profile. */
export function deriveResult(profile: StrengthProfile): InterviewResult {
  const shares = toDisplayShares(profile);
  const top = shares[0];
  return {
    shares,
    primarySlug: top && top.score > 0 ? top.slug : null,
  };
}

/** Every Marker id in the catalog — for the agent client's cite-only guard. */
export const catalogMarkerIds: ReadonlySet<string> = new Set(
  markerCatalog.map((m) => m.id),
);
