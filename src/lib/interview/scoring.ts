import "server-only";

import { markersForTribe } from "./markers";
import type {
  MarkerDelta,
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
 * Re-route matured fall-lines to the tribe's oil Marker (ADR-0004).
 *
 * A fall-line Marker fires on *resonance with the theme, not current
 * dysfunction*: when the agent reads an answer as describing a tendency the
 * participant has matured past, it tags the delta `integrated`. That maturity is
 * still evidence *of* the tribe, so this re-attributes the contribution to the
 * tribe's `oil` Marker — cross-confirming the attribution via a different Marker
 * type and moving the tribe's Posture toward *integrated* — **without lowering
 * strength**: the earned delta is carried through unchanged, even where it
 * exceeds the oil Marker's nominal weight (the strength was already validated
 * against the fall-line Marker upstream).
 *
 * Only `integrated` fall-lines route. An `active-shadow` or `neutral` fall-line
 * is a live tendency, left on its own Marker. Pure and non-mutating; a delta
 * whose tribe has no catalogued oil Marker is left untouched rather than lost.
 */
export function routeMaturedFallLines(
  deltas: readonly MarkerDelta[],
): MarkerDelta[] {
  return deltas.map((delta) => {
    if (delta.type !== "fallLine" || delta.postureSignal !== "integrated") {
      return delta;
    }
    const oil = markersForTribe(delta.tribeSlug).find((m) => m.type === "oil");
    if (!oil) return delta;
    return { ...delta, markerId: oil.id, type: "oil" };
  });
}

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
): { profile: StrengthProfile; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
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
