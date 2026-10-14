import { tribes } from "@/lib/tribes";
import type { Marker } from "./markers";
import type { PostureSignal, ScoredDelta, StrengthProfile } from "./types";

/**
 * The Scoring engine (ADR-0002/0003/0004) — pure, deterministic, and free of
 * both the LLM and the DB so it can be unit-tested in isolation. The agent
 * (`agent.ts`) proposes raw deltas from a model call; everything downstream of
 * that is here.
 *
 * It is deliberately catalog-agnostic: `validateScoredDeltas` takes the Marker
 * list as an argument rather than importing the `server-only` catalog, so this
 * module stays client-safe and tests can feed it a tiny fixture. The caller
 * (always server-side) passes the real `markerCatalog`.
 *
 * Two invariants from the ADRs are enforced here, not trusted to the prompt:
 *   - Marker-constrained (ADR-0003): a delta counts only if it cites a Marker
 *     that exists in the catalog; its `tribeSlug`/`type` are reconciled to the
 *     catalog entry (the catalog is authoritative, not the model's echo).
 *   - Additive strength (ADR-0004): every delta is clamped non-negative, so
 *     shadow/fall-line Markers raise strength like any other and a matured
 *     fall-line can never lower it.
 */

/** Posture signals the agent may report; anything else is coerced to `"neutral"`. */
export const POSTURE_SIGNALS = [
  "active-shadow",
  "neutral",
  "integrated",
] as const satisfies readonly PostureSignal[];

const POSTURE_SIGNAL_SET: ReadonlySet<string> = new Set(POSTURE_SIGNALS);

/** The shape the agent returns per delta, before validation against the catalog. */
export interface RawScoredDelta {
  markerId?: unknown;
  tribeSlug?: unknown;
  type?: unknown;
  delta?: unknown;
  postureSignal?: unknown;
}

/** Clamp a raw delta to a bounded, non-negative contribution (ADR-0004: additive). */
function clampDelta(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (n <= 0) return 0;
  return n > max ? max : n;
}

function coercePosture(value: unknown): PostureSignal {
  return typeof value === "string" && POSTURE_SIGNAL_SET.has(value)
    ? (value as PostureSignal)
    : "neutral";
}

/**
 * Constrain the agent's proposed deltas to the Marker Catalog (ADR-0003).
 *
 * A proposed delta survives only if its `markerId` resolves to a catalogued
 * Marker; unknown ids are dropped (the agent may not invent scoring rationale).
 * For a surviving delta the catalog is the source of truth: `tribeSlug` and
 * `type` are taken from the Marker, not the model's echo, and `delta` is clamped
 * to `[0, marker.weight]` so a single Marker's contribution stays bounded and
 * never negative. A delta clamped to 0 is kept in the trace (it records that the
 * Marker was considered) but contributes nothing to strength.
 */
export function validateScoredDeltas(
  raw: readonly RawScoredDelta[],
  markers: readonly Marker[],
): ScoredDelta[] {
  const byId = new Map(markers.map((m) => [m.id, m]));
  const out: ScoredDelta[] = [];

  for (const proposed of raw) {
    const id = typeof proposed.markerId === "string" ? proposed.markerId : null;
    if (!id) continue;
    const marker = byId.get(id);
    if (!marker) continue; // uncatalogued citation — dropped

    out.push({
      markerId: marker.id,
      tribeSlug: marker.tribeSlug,
      type: marker.type,
      delta: clampDelta(proposed.delta, marker.weight),
      postureSignal: coercePosture(proposed.postureSignal),
    });
  }

  return out;
}

/**
 * Fold validated deltas into a Strength Profile, returning a new profile (no
 * mutation). Deltas are additive across every Marker type (ADR-0004); a delta
 * for an unknown tribe slug is ignored defensively.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly ScoredDelta[],
): StrengthProfile {
  const next: StrengthProfile = { ...profile };
  for (const d of deltas) {
    if (!(d.tribeSlug in next)) continue;
    next[d.tribeSlug] += d.delta;
  }
  return next;
}

/**
 * Normalize a profile to display percentages that sum to 100 (ADR-0002). This
 * is cosmetic: the underlying per-tribe scores are independent and are not
 * mutually exclusive, so the shares exist only for rendering. When nothing has
 * been scored yet every tribe is 0 (not an even split), reflecting "no
 * evidence" rather than a flat prior.
 */
export function normalizeProfile(
  profile: StrengthProfile,
): Record<string, number> {
  const total = Object.values(profile).reduce(
    (sum, v) => sum + (v > 0 ? v : 0),
    0,
  );
  const shares: Record<string, number> = {};
  for (const [slug, value] of Object.entries(profile)) {
    shares[slug] = total > 0 ? ((value > 0 ? value : 0) / total) * 100 : 0;
  }
  return shares;
}

/** A fresh, zeroed strength profile covering all 12 tribes, keyed by slug. */
export function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  return profile;
}
