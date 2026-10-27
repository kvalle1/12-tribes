import "server-only";

import { markersForTribe } from "./markers";
import type {
  MarkerDelta,
  PostureReading,
  ScoreTraceEntry,
  StrengthProfile,
  TribePosture,
} from "./types";

/**
 * The Scoring engine (ADR-0002/0003/0004) — pure, deterministic functions that
 * fold validated Marker deltas into a Strength Profile, aggregate the Posture
 * axis, and normalize for display. It makes no model call: `agent.ts` turns an
 * answer into validated, catalog-bounded deltas, and this module applies them,
 * consulting the catalog only to find the oil Marker a matured fall-line routes
 * to (injectable, so tests can substitute it).
 * Keeping it pure is what makes the instrument's scoring testable and
 * reproducible run-to-run.
 *
 * `server-only` keeps the scoring logic off the client (ADR-0009): a Strength
 * Profile is an authoritative result, never something the client computes.
 */

/** Looks up the id of a tribe's oil Marker, if it has one. */
export type OilMarkerLookup = (tribeSlug: string) => string | undefined;

/** The catalog's oil Marker for a tribe (the catalog authors one per tribe). */
export const catalogOilMarker: OilMarkerLookup = (tribeSlug) =>
  markersForTribe(tribeSlug).find((m) => m.type === "oil")?.id;

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
 * A **matured fall-line** (a fall-line Marker with an `integrated` signal) is
 * recorded against the tribe's oil Marker instead (ADR-0004): growth past the
 * tendency cross-confirms the tribe through its oil, so the trace cites the oil
 * Marker with `routedFrom` naming the fall-line. The full delta carries over —
 * it is not re-capped at the oil Marker's weight — so routing never lowers
 * strength relative to an unmatured answer.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly MarkerDelta[],
  turnIndex: number,
  oilMarkerFor: OilMarkerLookup = catalogOilMarker,
): { profile: StrengthProfile; trace: ScoreTraceEntry[] } {
  const next: StrengthProfile = { ...profile };
  const trace: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
    if (!Object.hasOwn(next, delta.tribeSlug)) continue;

    // Additive only: a contribution never lowers a tribe's strength.
    const applied = Math.max(0, delta.delta);
    next[delta.tribeSlug] += applied;

    const oilId =
      delta.type === "fallLine" && delta.postureSignal === "integrated"
        ? oilMarkerFor(delta.tribeSlug)
        : undefined;

    trace.push({
      turnIndex,
      markerId: oilId ?? delta.markerId,
      tribeSlug: delta.tribeSlug,
      type: oilId ? "oil" : delta.type,
      delta: applied,
      postureSignal: delta.postureSignal,
      ...(oilId && { routedFrom: delta.markerId }),
    });
  }

  return { profile: next, trace };
}

/** How far past even an arc must lean to read as one side rather than mixed. */
export const POSTURE_LEAN = 1 / 3;

function postureReading(arc: number | null): PostureReading {
  if (arc === null) return "unread";
  if (arc >= POSTURE_LEAN) return "integrated";
  if (arc <= -POSTURE_LEAN) return "active-shadow";
  return "mixed";
}

/**
 * Aggregate the Posture axis (ADR-0004) from the score trace, for each of the
 * given tribes. Posture is orthogonal to strength: each trace entry's delta is
 * tallied toward `integrated` or `activeShadow` by its signal (neutral evidence
 * counts toward neither), and `arc` is their balance from -1 to +1. Derived from
 * the trace rather than stored separately, so it replays identically on resume.
 */
export function accumulatePosture(
  trace: readonly ScoreTraceEntry[],
  slugs: readonly string[],
): Record<string, TribePosture> {
  const tallies = new Map(slugs.map((slug) => [slug, { integrated: 0, activeShadow: 0 }]));
  for (const entry of trace) {
    const tally = tallies.get(entry.tribeSlug);
    if (!tally) continue;
    if (entry.postureSignal === "integrated") tally.integrated += entry.delta;
    else if (entry.postureSignal === "active-shadow") tally.activeShadow += entry.delta;
  }

  const posture: Record<string, TribePosture> = {};
  for (const [slug, { integrated, activeShadow }] of tallies) {
    const total = integrated + activeShadow;
    const arc = total > 0 ? (integrated - activeShadow) / total : null;
    posture[slug] = { integrated, activeShadow, arc, reading: postureReading(arc) };
  }
  return posture;
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
