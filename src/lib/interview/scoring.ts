import "server-only";

import type {
  MarkerDelta,
  PostureArc,
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

/**
 * The Posture axis (ADR-0004) — the second thing every scored Marker feeds.
 * Where strength asks *is this wiring present?*, Posture asks *where on the
 * fall→oil arc?*, from active-shadow (living the fall-line) to integrated
 * (matured past it). Posture rides the **same** evidence as strength: each
 * delta's `postureSignal` routes its (already-clamped, non-negative) weight to a
 * pole, so a tribe is never placed on an arc it has no strength evidence for,
 * and a `neutral` answer moves neither pole.
 *
 * This is why the matured-fall-line rule (ADR-0004) is coherent: a fall-line a
 * participant has grown past is still evidence *of* the tribe, so the agent
 * routes it to the tribe's `oil` Marker with an `integrated` signal — raising
 * strength (via `applyDeltas`) while moving Posture toward integrated here,
 * never subtracting.
 */

/** How lopsided the two poles must be before Posture reads as one of them. */
export const POSTURE_DECIDED = 0.34;

/** A zeroed tally — no posture evidence on either pole. */
export function emptyPostureTally(): PostureTally {
  return { activeShadow: 0, integrated: 0 };
}

/** Add one signal's weight to the matching pole of a tally (pure; non-neutral only). */
function foldPostureSignal(
  tally: PostureTally,
  signal: MarkerDelta["postureSignal"],
  weight: number,
): PostureTally {
  const applied = Math.max(0, weight);
  if (applied === 0) return tally;
  if (signal === "active-shadow") {
    return { activeShadow: tally.activeShadow + applied, integrated: tally.integrated };
  }
  if (signal === "integrated") {
    return { activeShadow: tally.activeShadow, integrated: tally.integrated + applied };
  }
  return tally; // neutral carries no posture
}

/**
 * Fold a Turn's validated deltas into running per-tribe Posture tallies,
 * returning a new map (no mutation). Posture is accumulated alongside strength
 * from the very same deltas `applyDeltas` folds into the profile.
 */
export function accumulatePosture(
  current: Record<string, PostureTally>,
  deltas: readonly MarkerDelta[],
): Record<string, PostureTally> {
  const next: Record<string, PostureTally> = { ...current };
  for (const delta of deltas) {
    if (delta.postureSignal === "neutral") continue;
    const folded = foldPostureSignal(
      next[delta.tribeSlug] ?? emptyPostureTally(),
      delta.postureSignal,
      delta.delta,
    );
    if (folded.activeShadow > 0 || folded.integrated > 0) {
      next[delta.tribeSlug] = folded;
    }
  }
  return next;
}

/**
 * Replay the whole score trace into per-tribe Posture tallies — the posture
 * analogue of the profile the trace produces, so no extra persisted state is
 * needed (it is derived from the always-present trace, like `profileHistory`).
 */
export function posturePerTribe(
  traceEntries: readonly ScoreTraceEntry[],
): Record<string, PostureTally> {
  return accumulatePosture({}, traceEntries);
}

/**
 * Resolve a tally to an arc position. The `score` is the signed margin between
 * poles in [-1, 1] (−1 fully active-shadow, +1 fully integrated); the arc label
 * reads a pole only when that margin clears `POSTURE_DECIDED`, else `mixed`. No
 * evidence reads as `unknown` with a zero score (no divide-by-zero).
 */
export function classifyPosture(tally: PostureTally): PostureReading {
  const total = tally.activeShadow + tally.integrated;
  if (total <= 0) return { arc: "unknown", score: 0, tally };
  const score = (tally.integrated - tally.activeShadow) / total;
  const arc: PostureArc =
    score >= POSTURE_DECIDED
      ? "integrated"
      : score <= -POSTURE_DECIDED
        ? "active-shadow"
        : "mixed";
  return { arc, score, tally };
}

/**
 * The per-tribe Posture reading derived from a score trace: the stable Posture
 * half of the Interview's output contract (ADR-0004). Only tribes with
 * posture-bearing evidence appear.
 */
export function readPosture(
  traceEntries: readonly ScoreTraceEntry[],
): Record<string, PostureReading> {
  const tallies = posturePerTribe(traceEntries);
  const readings: Record<string, PostureReading> = {};
  for (const [slug, tally] of Object.entries(tallies)) {
    readings[slug] = classifyPosture(tally);
  }
  return readings;
}
