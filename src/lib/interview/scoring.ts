import "server-only";

import { getMarkerById } from "./markers";
import type {
  PostureProfile,
  ScoredDelta,
  ScoredMarkerType,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * The Scoring engine (deep, pure) — slice 3, #16.
 *
 * It turns the agent's cited Marker deltas into an updated Strength Profile,
 * Posture tally, and score trace. It is deliberately *dumb about interpretation*:
 * the agent decides which Markers fired (that judgment lives in the LLM call and
 * is constrained to the catalog by ADR-0003); this module only validates those
 * citations against the catalog and folds them in by fixed rules.
 *
 * The rules a future reader must not "fix":
 *   - Every delta is **additive and non-negative**, including `shadow`/`fallLine`
 *     (ADR-0004). Resonance with a shadow or fall-line theme is *evidence of* the
 *     tribe, so it raises strength and never lowers it. Maturity around a
 *     fall-line is expressed by the agent citing the tribe's **oil** Marker with a
 *     positive `postureSignal` — routing, not subtraction, happens upstream.
 *   - Strength and Posture are **orthogonal** (ADR-0004): `postureSignal` moves
 *     only the Posture tally, never strength.
 *   - Underlying strengths are **independent** (ADR-0002); normalization to
 *     percentages is display-only and must not be treated as a distribution.
 *
 * `import "server-only"` keeps the engine (and the catalog it cites) off the
 * client. Under Vitest the marker package is stubbed, so the pure logic is still
 * unit-testable in Node.
 */

/** Raised when an agent scoring payload can't be trusted against the catalog. */
export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

const MARKER_TYPE_VALUES: readonly ScoredMarkerType[] = [
  "strength",
  "oil",
  "shadow",
  "fallLine",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate a raw agent tool-use payload into trustworthy `ScoredDelta`s.
 *
 * This is the ADR-0003 gate: the agent may only score by citing a catalogued
 * Marker. Each entry must resolve to a real Marker whose `tribeSlug` and `type`
 * match what the agent claims — a mismatch means the agent invented a rationale
 * and is rejected rather than silently scored. Bounds are then enforced so a
 * hallucinated magnitude can't blow up the profile: `delta` is clamped into
 * `[0, marker.weight]` (non-negative preserves the additive rule; the Marker's
 * own weight is the ceiling) and `postureSignal` into `[-1, 1]`.
 *
 * Throws `ScoringError` on the first structural or citation violation.
 */
export function parseScoringPayload(raw: unknown): ScoredDelta[] {
  if (!Array.isArray(raw)) {
    throw new ScoringError("Scoring payload must be an array of deltas.");
  }

  return raw.map((entry, i) => {
    if (!isPlainRecord(entry)) {
      throw new ScoringError(`Delta ${i} is not an object.`);
    }

    const { markerId, tribeSlug, type, delta, postureSignal } = entry;

    if (typeof markerId !== "string" || !markerId) {
      throw new ScoringError(`Delta ${i} has a missing or invalid markerId.`);
    }

    const marker = getMarkerById(markerId);
    if (!marker) {
      throw new ScoringError(
        `Delta ${i} cites an unknown Marker id: ${markerId}`,
      );
    }

    if (tribeSlug !== marker.tribeSlug) {
      throw new ScoringError(
        `Delta ${i} (${markerId}) claims tribe ${String(tribeSlug)} but the Marker belongs to ${marker.tribeSlug}.`,
      );
    }

    if (type !== marker.type) {
      throw new ScoringError(
        `Delta ${i} (${markerId}) claims type ${String(type)} but the Marker is ${marker.type}.`,
      );
    }

    if (typeof delta !== "number" || !Number.isFinite(delta)) {
      throw new ScoringError(`Delta ${i} (${markerId}) has a non-finite delta.`);
    }

    if (typeof postureSignal !== "number" || !Number.isFinite(postureSignal)) {
      throw new ScoringError(
        `Delta ${i} (${markerId}) has a non-finite postureSignal.`,
      );
    }

    // `type` is now known to equal `marker.type`, which is a valid MarkerType,
    // but assert the union defensively for the narrowed return type.
    if (!MARKER_TYPE_VALUES.includes(marker.type)) {
      throw new ScoringError(`Delta ${i} (${markerId}) has an unknown type.`);
    }

    return {
      markerId,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      delta: clamp(delta, 0, marker.weight),
      postureSignal: clamp(postureSignal, -1, 1),
    } satisfies ScoredDelta;
  });
}

/** The result of folding one Turn's deltas into the running Session state. */
export interface AppliedScoring {
  profile: StrengthProfile;
  posture: PostureProfile;
  trace: ScoreTraceEntry[];
}

/**
 * Fold a Turn's validated deltas into the running strength/posture/trace,
 * returning fresh objects (never mutating the inputs). `turnIndex` is the index
 * of the answered Turn, stamped onto each trace entry so the trace links back to
 * the exact answer.
 *
 * Slugs absent from `profile`/`posture` are treated as starting at 0, so a delta
 * for any catalogued tribe applies even against a sparsely-initialised state.
 */
export function applyScoring(
  base: { profile: StrengthProfile; posture: PostureProfile; trace: ScoreTraceEntry[] },
  turnIndex: number,
  deltas: readonly ScoredDelta[],
): AppliedScoring {
  const profile: StrengthProfile = { ...base.profile };
  const posture: PostureProfile = { ...base.posture };
  const trace: ScoreTraceEntry[] = [...base.trace];

  for (const d of deltas) {
    // Additive and non-negative for every Marker type (ADR-0004).
    profile[d.tribeSlug] = (profile[d.tribeSlug] ?? 0) + d.delta;
    // Posture is orthogonal: it moves independently of strength.
    posture[d.tribeSlug] = (posture[d.tribeSlug] ?? 0) + d.postureSignal;
    trace.push({
      turnIndex,
      markerId: d.markerId,
      tribeSlug: d.tribeSlug,
      type: d.type,
      delta: d.delta,
      postureSignal: d.postureSignal,
    });
  }

  return { profile, posture, trace };
}

/**
 * Project the independent per-tribe strengths onto display percentages that sum
 * to ~100 (ADR-0002). This is cosmetic: the caller keeps the underlying profile
 * as the source of truth. An all-zero profile normalizes to all zeros rather than
 * dividing by zero.
 */
export function normalizeProfile(
  profile: StrengthProfile,
): Record<string, number> {
  const total = Object.values(profile).reduce((sum, v) => sum + v, 0);
  const out: Record<string, number> = {};
  for (const [slug, value] of Object.entries(profile)) {
    out[slug] = total > 0 ? (value / total) * 100 : 0;
  }
  return out;
}
