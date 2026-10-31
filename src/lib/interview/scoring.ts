import "server-only";

import type {
  MarkerDelta,
  PostureReading,
  PostureTallies,
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

/** Options that extend `applyDeltas` with the Posture axis (ADR-0004). */
export interface ApplyDeltasOptions {
  /** The running Posture tallies to fold the Turn's signals into. Defaults to empty. */
  posture?: PostureTallies;
  /**
   * Resolves a tribe's oil Marker id, used to re-attribute a matured fall-line
   * (ADR-0004). Injected rather than imported so the scoring engine stays pure
   * and catalog-free; the real caller supplies it from the Marker Catalog.
   */
  oilMarkerFor?: (tribeSlug: string) => string | undefined;
}

/**
 * Fold a Turn's validated deltas into the running profile, returning a new
 * profile and Posture tallies (no mutation) and the trace entries for the
 * applied deltas.
 *
 * The underlying scores are independent per-tribe tallies (ADR-0002): a delta
 * accumulates onto its tribe and touches no other. Three rules shape the fold:
 *
 *  - **Additive, never subtractive (ADR-0004).** Every contribution raises
 *    strength or leaves it unchanged. A shadow or fall-line Marker fires on
 *    *resonance with the theme*, so maturity around a fall-line is still
 *    evidence *of* the tribe — a negative delta (anyone "fixing" the confound
 *    by subtracting) is clamped to zero rather than lowering strength.
 *  - **Posture is orthogonal (ADR-0004).** Each posture-bearing signal counts
 *    toward the tribe's Posture tally — `integrated` or `active-shadow` — while
 *    `neutral` bears only on strength. A **matured fall-line** (a fall-line
 *    scored with an `integrated` signal) is re-attributed in the trace to the
 *    tribe's `oil` Marker: maturity around the tendency cross-confirms the
 *    tribe via a different Marker type, and it never lowers strength.
 *  - **Known tribes only.** A delta whose `tribeSlug` is not already a key of
 *    the profile is a validation miss; it is dropped rather than inventing a
 *    new tribe.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly MarkerDelta[],
  turnIndex: number,
  { posture = {}, oilMarkerFor }: ApplyDeltasOptions = {},
): { profile: StrengthProfile; posture: PostureTallies; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const nextPosture: PostureTallies = {};
  for (const [slug, tally] of Object.entries(posture)) {
    nextPosture[slug] = { ...tally };
  }
  const trace: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
    if (!Object.hasOwn(next, delta.tribeSlug)) continue;

    // Additive only: a contribution never lowers a tribe's strength.
    const applied = Math.max(0, delta.delta);
    next[delta.tribeSlug] += applied;

    // Posture tally: integrated vs active-shadow; neutral bears only on strength.
    const tally = (nextPosture[delta.tribeSlug] ??= { integrated: 0, activeShadow: 0 });
    if (delta.postureSignal === "integrated") tally.integrated += 1;
    else if (delta.postureSignal === "active-shadow") tally.activeShadow += 1;

    // A matured fall-line routes the evidence to the tribe's oil Marker.
    const matured = delta.type === "fallLine" && delta.postureSignal === "integrated";
    const type = matured ? "oil" : delta.type;
    const markerId = matured ? (oilMarkerFor?.(delta.tribeSlug) ?? delta.markerId) : delta.markerId;

    trace.push({
      turnIndex,
      markerId,
      tribeSlug: delta.tribeSlug,
      type,
      delta: applied,
      postureSignal: delta.postureSignal,
    });
  }

  return { profile: next, posture: nextPosture, trace };
}

/**
 * How decisive a Posture lean must be to read as `integrated` or
 * `active-shadow` rather than `mixed`: the signed share of the arc, from -1
 * (all active-shadow) to +1 (all integrated), must clear this threshold.
 */
export const POSTURE_MARGIN = 1 / 3;

/**
 * Read a tribe's `PostureTally` into a position on its fall→oil arc (ADR-0004).
 * `score` is `(integrated − activeShadow) / total` in [-1, 1]; `reading` buckets
 * it, with `unknown` when no posture-bearing evidence has accumulated. Pure and
 * total — an absent tally reads as `unknown`.
 */
export function posturePosition(
  tally: PostureTally | undefined,
): { reading: PostureReading; score: number } {
  const integrated = tally?.integrated ?? 0;
  const activeShadow = tally?.activeShadow ?? 0;
  const total = integrated + activeShadow;
  if (total === 0) return { reading: "unknown", score: 0 };

  const score = (integrated - activeShadow) / total;
  const reading: PostureReading =
    score > POSTURE_MARGIN ? "integrated" : score < -POSTURE_MARGIN ? "active-shadow" : "mixed";
  return { reading, score };
}

/** A short, human label for a Posture reading, for the result view. */
export function postureLabel(reading: PostureReading): string {
  switch (reading) {
    case "integrated":
      return "Integrated";
    case "active-shadow":
      return "Active-shadow";
    case "mixed":
      return "Mixed";
    case "unknown":
      return "Not enough signal";
  }
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
