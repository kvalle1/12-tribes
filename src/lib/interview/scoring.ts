import "server-only";

import type {
  MarkerDelta,
  PostureReading,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * Resolves a tribe's oil Marker id, used to route a matured fall-line (ADR-0004).
 * Injected rather than imported so the scoring engine keeps holding no catalog
 * and stays unit-testable without one; `flow.ts` supplies the real resolver from
 * the Marker Catalog.
 */
export type OilMarkerResolver = (tribeSlug: string) => string | undefined;

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
 * **Matured fall-line → oil routing (ADR-0004).** A fall-line delta the agent
 * marked `integrated` is someone describing having *grown past* that tendency.
 * That resonance is evidence of the tribe at its healthy, integrated end, so
 * when an `oilMarkerFor` resolver is supplied the trace entry is re-attributed
 * to the tribe's oil Marker (its `type` becomes `oil`) and keeps the `integrated`
 * posture signal. Strength is untouched — the full contribution still lands on
 * the tribe (never reduced for maturity); only the Marker it is credited to, and
 * thus its Posture pull, changes.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly MarkerDelta[],
  turnIndex: number,
  oilMarkerFor?: OilMarkerResolver,
): { profile: StrengthProfile; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
    if (!Object.hasOwn(next, delta.tribeSlug)) continue;

    // Additive only: a contribution never lowers a tribe's strength.
    const applied = Math.max(0, delta.delta);
    next[delta.tribeSlug] += applied;

    // Route a matured fall-line to the tribe's oil Marker, if one is known.
    const routedOilId =
      delta.type === "fallLine" && delta.postureSignal === "integrated"
        ? oilMarkerFor?.(delta.tribeSlug)
        : undefined;

    trace.push({
      turnIndex,
      markerId: routedOilId ?? delta.markerId,
      tribeSlug: delta.tribeSlug,
      type: routedOilId ? "oil" : delta.type,
      delta: applied,
      postureSignal: delta.postureSignal,
    });
  }

  return { profile: next, trace };
}

/**
 * A tribe only reads as `integrated` or `active-shadow` when one end leads by at
 * least this fraction of its posture-bearing evidence. Below it the arc is
 * `neutral` ("emerging") — a near-tie between the two ends is contradictory
 * evidence, not a confident lean, and must not trigger the result page's
 * one-sided arc framing (ADR-0007: the reading stays honest, never over-claimed).
 */
export const POSTURE_DEAD_BAND = 0.2;

/**
 * Aggregate the score trace into a per-tribe {@link PostureReading} — where the
 * participant sits on each tribe's fall→oil arc (ADR-0004). Each posture-bearing
 * entry pulls its tribe toward one end weighted by the entry's `delta` (its
 * evidential strength), so one heavy signal outweighs several light ones;
 * `neutral` entries do not move Posture. The arc only commits to an end when the
 * lead clears {@link POSTURE_DEAD_BAND} of the total pull, so mixed or balanced
 * evidence reads neutral rather than flapping to whichever side is barely ahead.
 * Pure and derived entirely from the trace, so no extra per-Turn state is
 * persisted — Posture is read the way `profileHistory` replays the ranking.
 *
 * Only tribes with at least one trace entry get a reading; a tribe with no
 * evidence has no arc to report.
 */
export function accumulatePosture(
  trace: readonly ScoreTraceEntry[],
): Record<string, PostureReading> {
  const tallies: Record<string, { integrated: number; activeShadow: number }> = {};
  for (const entry of trace) {
    const tally = (tallies[entry.tribeSlug] ??= { integrated: 0, activeShadow: 0 });
    if (entry.postureSignal === "integrated") tally.integrated += entry.delta;
    else if (entry.postureSignal === "active-shadow") tally.activeShadow += entry.delta;
  }

  const readings: Record<string, PostureReading> = {};
  for (const [slug, { integrated, activeShadow }] of Object.entries(tallies)) {
    const net = integrated - activeShadow;
    const total = integrated + activeShadow;
    const clears = total > 0 && Math.abs(net) / total >= POSTURE_DEAD_BAND;
    readings[slug] = {
      integrated,
      activeShadow,
      net,
      arc: !clears ? "neutral" : net > 0 ? "integrated" : "active-shadow",
    };
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
