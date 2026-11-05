import "server-only";

import type {
  MarkerDelta,
  PostureProfile,
  PostureReading,
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
 * `resolveOilMarker` wires in the matured-fall-line → oil routing (ADR-0004):
 * when a fall-line Marker fires with an `integrated` posture — maturity *around*
 * the tendency, which is evidence *of* the tribe — the contribution is recorded
 * against the tribe's `oil` Marker instead, cross-confirming the attribution via
 * a different Marker type. It is injected rather than imported so this module
 * stays catalog-free and unit-testable in isolation; `flow.ts` passes the real
 * catalog lookup. With no resolver (or none found) the routing degrades to
 * recording the fall-line Marker as-is — strength and posture are unchanged
 * either way, since routing never alters the delta's magnitude or signal.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly MarkerDelta[],
  turnIndex: number,
  resolveOilMarker?: OilMarkerResolver,
): { profile: StrengthProfile; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
    if (!Object.hasOwn(next, delta.tribeSlug)) continue;

    // Additive only: a contribution never lowers a tribe's strength.
    const applied = Math.max(0, delta.delta);
    next[delta.tribeSlug] += applied;

    // Route a matured fall-line to the tribe's oil Marker (ADR-0004). This only
    // re-labels the trace entry (Marker id + type); the strength already added
    // above and the posture signal carried below are untouched, so a matured
    // fall-line never lowers strength.
    const oilMarkerId =
      delta.type === "fallLine" && delta.postureSignal === "integrated"
        ? resolveOilMarker?.(delta.tribeSlug)
        : undefined;

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
 * Resolves a tribe `slug` to the id of its `oil` Marker, or undefined when the
 * tribe has none. Injected into {@link applyDeltas} to keep the scoring engine
 * free of the Marker Catalog (see its note above).
 */
export type OilMarkerResolver = (tribeSlug: string) => string | undefined;

/**
 * Fraction of the net posture lean (over total posture evidence) a tribe needs
 * to read as decisively `integrated` or `active-shadow` rather than `mixed`.
 * `0.25` means one arc end must carry ~62.5% of the posture evidence to win the
 * reading. Tunable, like the Stop Condition thresholds.
 */
export const POSTURE_DOMINANCE = 0.25;

/**
 * Fold the posture-bearing evidence in a score trace into per-tribe tallies
 * (ADR-0004). Posture is orthogonal to strength: `integrated` and
 * `active-shadow` evidence pulls toward opposite ends of the fall→oil arc, each
 * weighted by its applied delta; `neutral` evidence pulls toward neither and is
 * not tallied. Derived from the trace so no extra Session state is persisted —
 * the same replay approach the ranking history uses.
 */
export function derivePostureProfile(
  trace: readonly ScoreTraceEntry[],
): PostureProfile {
  const posture: PostureProfile = {};
  for (const entry of trace) {
    const tally = (posture[entry.tribeSlug] ??= { integrated: 0, activeShadow: 0 });
    if (entry.postureSignal === "integrated") {
      tally.integrated += entry.delta;
    } else if (entry.postureSignal === "active-shadow") {
      tally.activeShadow += entry.delta;
    }
  }
  return posture;
}

/**
 * Read a tribe's position on its fall→oil arc from its posture tally. `unknown`
 * when there is no posture-bearing evidence; otherwise the net lean decides
 * between the two arc ends, with `mixed` for evidence pulling both ways within
 * {@link POSTURE_DOMINANCE}.
 */
export function derivePosture(tally: PostureTally | undefined): PostureReading {
  if (!tally) return "unknown";
  const total = tally.integrated + tally.activeShadow;
  if (total <= 0) return "unknown";
  const score = (tally.integrated - tally.activeShadow) / total;
  if (score >= POSTURE_DOMINANCE) return "integrated";
  if (score <= -POSTURE_DOMINANCE) return "active-shadow";
  return "mixed";
}

/**
 * Per-tribe posture readings derived from a trace. Pass `slugs` to force a
 * reading for every tribe of interest (e.g. all 12) — tribes with no
 * posture-bearing evidence read `unknown` rather than being omitted.
 */
export function derivePostureReadings(
  trace: readonly ScoreTraceEntry[],
  slugs?: readonly string[],
): Record<string, PostureReading> {
  const posture = derivePostureProfile(trace);
  const keys = slugs ?? Object.keys(posture);
  const readings: Record<string, PostureReading> = {};
  for (const slug of keys) {
    readings[slug] = derivePosture(posture[slug]);
  }
  return readings;
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
