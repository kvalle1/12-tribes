import type { Marker, MarkerType } from "./markers";
import type { StrengthProfile } from "./types";

/**
 * The Interview scoring engine (issue #16, ADR-0002/0003/0004) — pure and
 * dependency-free so it can be unit-tested without the LLM or the database.
 *
 * The agent may only score by *citing a catalogued Marker* (ADR-0003): every
 * delta names a `markerId`, and this engine looks that id up, applies the
 * Marker's bounded `weight`, and folds the result into the running Strength
 * Profile. A delta that cites an unknown Marker — or whose `tribeSlug` doesn't
 * match the cited Marker — is ignored, so the model can never invent scoring
 * rationale that isn't grounded in the rubric.
 *
 * The Marker Catalog itself is `server-only` (ADR-0009/0010). This module stays
 * neutral by taking a `lookup` function instead of importing the catalog, which
 * is also what lets tests drive it with a tiny hand-built catalog. The `Marker`
 * / `MarkerType` imports are type-only and erased at build, so importing this
 * from anywhere does not pull the catalog into a client bundle.
 */

/** Where on a tribe's fall→oil arc an answer sits (ADR-0004). Full Posture handling is issue #20. */
export type PostureSignal = "active-shadow" | "integrated" | "neutral";

/**
 * One scored observation the agent returns from interpreting an answer. `delta`
 * is the evidence *strength* (0–1) — how strongly the answer evidences the
 * Marker — not the final strength contribution; the engine scales it by the
 * Marker's weight.
 */
export interface MarkerDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** Evidence strength in [0, 1]; values outside are clamped. */
  delta: number;
  postureSignal?: PostureSignal;
}

/**
 * A single applied delta, retained as the score trace (answer → Marker → delta)
 * so a participant can later see *why* a tribe scored as it did (issue #21).
 */
export interface AppliedDelta {
  markerId: string;
  tribeSlug: string;
  type: MarkerType;
  /** The (clamped) evidence strength the agent assigned. */
  delta: number;
  /** The Marker's weight from the catalog. */
  weight: number;
  /** The strength added to the tribe: clamped-delta × weight, always ≥ 0. */
  contribution: number;
  postureSignal: PostureSignal;
}

export interface ScoreResult {
  /** A new profile (the input is never mutated). */
  profile: StrengthProfile;
  /** The deltas that resolved against the catalog, in input order. */
  applied: AppliedDelta[];
}

/** Resolve a Marker by its id, or `undefined` if it isn't in the catalog. */
export type MarkerLookup = (id: string) => Marker | undefined;

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Apply cited-Marker deltas to a Strength Profile, returning the new profile and
 * the score trace. Never mutates the input.
 *
 * Rules (ADR-0004): a shadow/fall-line delta is **additive to strength and
 * never lowers it** — maturity around a fall-line is evidence *of* the tribe,
 * not against it. Contributions are therefore clamped to ≥ 0 (a negative
 * `delta` becomes 0), so no delta can ever reduce a tribe's strength.
 *
 * A delta is dropped (not applied, not traced) when its `markerId` doesn't
 * resolve or its `tribeSlug` disagrees with the cited Marker — the agent can
 * only score through the rubric (ADR-0003).
 */
export function applyScoring(
  base: StrengthProfile,
  deltas: readonly MarkerDelta[],
  lookup: MarkerLookup,
): ScoreResult {
  const profile: StrengthProfile = { ...base };
  const applied: AppliedDelta[] = [];

  for (const d of deltas) {
    const marker = lookup(d.markerId);
    // Uncited or mis-cited: the agent may only score through the catalog.
    if (!marker || marker.tribeSlug !== d.tribeSlug) continue;

    const strength = clampUnit(d.delta);
    const contribution = strength * marker.weight;

    profile[marker.tribeSlug] = (profile[marker.tribeSlug] ?? 0) + contribution;
    applied.push({
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      delta: strength,
      weight: marker.weight,
      contribution,
      postureSignal: d.postureSignal ?? "neutral",
    });
  }

  return { profile, applied };
}

/**
 * Project a Strength Profile onto display percentages that sum to ~100
 * (ADR-0002). This is cosmetic: the underlying scores are independent and are
 * **not** a probability distribution, so callers must not treat the normalized
 * shares as mutually exclusive. An all-zero profile normalizes to all zeros
 * rather than dividing by zero.
 */
export function normalizeProfile(
  profile: StrengthProfile,
): Record<string, number> {
  const total = Object.values(profile).reduce((sum, v) => sum + v, 0);
  const shares: Record<string, number> = {};
  for (const [slug, value] of Object.entries(profile)) {
    shares[slug] = total > 0 ? (value / total) * 100 : 0;
  }
  return shares;
}
