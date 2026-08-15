import "server-only";

import { getMarkerById, type Marker } from "./markers";
import { POSTURE_SIGNALS } from "./types";
import type {
  MarkerDelta,
  PostureSignal,
  ScoreTrace,
  StrengthProfile,
} from "./types";

/**
 * The Scoring engine (ADR-0002/0003/0004) — the pure core that turns the agent's
 * cited Marker deltas into an updated Strength Profile plus an audit trail.
 *
 * It is **server-only**: scoring logic and the Marker Catalog it consults must
 * never reach the client (ADR-0009 trust boundary). The `import "server-only"`
 * makes a client import a build error; the module is otherwise a pure function
 * of its inputs, so it is exhaustively unit-testable without a DB or the LLM.
 *
 * The two rules that make this defensible:
 *
 *  - **Marker-constrained (ADR-0003).** A delta counts only if it cites a real
 *    catalogued Marker whose `tribeSlug`/`type` match the citation. Anything else
 *    — an invented id, a mis-attributed tribe — is dropped, not scored. The agent
 *    cannot smuggle in ad-hoc rationale.
 *  - **Additive (ADR-0004).** Every delta *adds* to strength and never lowers it,
 *    including shadow and fall-line Markers. A matured fall-line is evidence *of*
 *    the tribe; reading its absence as absence-of-tribe is the confound this rule
 *    exists to prevent. Posture, not strength, carries the arc.
 */

/** The running scoring state the engine folds deltas into. */
export interface ScoringState {
  profile: StrengthProfile;
  traces: ScoreTrace[];
}

/**
 * Clamp a raw agent-proposed delta to a non-negative contribution bounded by the
 * Marker's own weight. Non-numeric, NaN, or non-positive proposals contribute 0,
 * which keeps scoring additive and stops a single answer from dominating.
 */
function boundDelta(raw: number, marker: Marker): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, marker.weight);
}

/**
 * Apply the agent's cited Marker deltas for one answer to the running state,
 * returning a new state (no mutation). `turnIndex` is the position of the answer
 * in `turns`, recorded on every resulting trace so a delta can always be walked
 * back to the answer that produced it.
 */
export function applyMarkerDeltas(
  state: ScoringState,
  turnIndex: number,
  deltas: readonly MarkerDelta[],
): ScoringState {
  const profile: StrengthProfile = { ...state.profile };
  const traces: ScoreTrace[] = [...state.traces];

  for (const d of deltas) {
    const marker = getMarkerById(d.markerId);
    if (!marker) continue; // uncatalogued citation — drop (ADR-0003)
    if (marker.tribeSlug !== d.tribeSlug) continue; // mis-attributed tribe — drop
    if (marker.type !== d.type) continue; // mismatched Marker type — drop
    if (!POSTURE_SIGNALS.includes(d.postureSignal)) continue; // bad posture — drop

    const amount = boundDelta(d.delta, marker);
    if (amount <= 0) continue;

    // Additive, never lowering — shadow/fall-line included (ADR-0004).
    profile[marker.tribeSlug] = (profile[marker.tribeSlug] ?? 0) + amount;
    traces.push({
      turnIndex,
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      delta: amount,
      postureSignal: d.postureSignal,
    });
  }

  return { profile, traces };
}

/**
 * Normalize the independent per-tribe strengths into display percentages that
 * sum to ~100 (ADR-0002). Normalization is cosmetic: the underlying scores stay
 * independent and must not be read as a probability distribution. Every tribe is
 * 0 before anything has scored.
 */
export function attribution(profile: StrengthProfile): Record<string, number> {
  const total = Object.values(profile).reduce(
    (sum, v) => sum + (v > 0 ? v : 0),
    0,
  );
  const out: Record<string, number> = {};
  for (const slug of Object.keys(profile)) {
    const v = profile[slug] > 0 ? profile[slug] : 0;
    out[slug] = total > 0 ? (v / total) * 100 : 0;
  }
  return out;
}

/**
 * Aggregate each tribe's Posture from its traces — the dominant point on its
 * fall→oil arc (ADR-0004). Only tribes with scored Markers appear. Kept simple
 * for this slice: the most-frequent signal wins, ties broken toward the more
 * integrated reading (its later position in `POSTURE_SIGNALS`).
 */
export function aggregatePosture(
  traces: readonly ScoreTrace[],
): Record<string, PostureSignal> {
  const tally: Record<string, Record<PostureSignal, number>> = {};
  for (const t of traces) {
    const counts =
      tally[t.tribeSlug] ??
      (tally[t.tribeSlug] = { "active-shadow": 0, aware: 0, integrated: 0 });
    counts[t.postureSignal] += 1;
  }

  const out: Record<string, PostureSignal> = {};
  for (const slug of Object.keys(tally)) {
    const counts = tally[slug];
    out[slug] = POSTURE_SIGNALS.reduce((best, signal) =>
      counts[signal] >= counts[best] ? signal : best,
    );
  }
  return out;
}
