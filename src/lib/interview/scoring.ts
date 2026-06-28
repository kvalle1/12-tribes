import type {
  MarkerType,
  ScoreDelta,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * The pure Scoring engine for the Interview (PRD #13, slice #16).
 *
 * It applies the agent's cited Marker deltas to a running Strength Profile and
 * records a score trace. It is deliberately pure — no LLM, no DB, no catalog
 * import — so its behavior can be unit-tested in isolation. The authoritative
 * Marker facts (which tribe, which type, the weight cap) are supplied by an
 * injected `MarkerLookup`; the real caller passes the server-only catalog, tests
 * pass a fake.
 *
 * Two invariants live here (ADR-0004): every contribution is **additive** — a
 * shadow or fall-line Marker raises a tribe's strength exactly like a strength
 * Marker and can **never lower** it — and contributions are **bounded** by the
 * Marker's weight, so the agent cannot inflate a score past the catalog's cap.
 */

/** The authoritative facts about a Marker, resolved from the catalog. */
export interface MarkerInfo {
  tribeSlug: string;
  type: MarkerType;
  /** Upper bound on a single contribution from this Marker. */
  weight: number;
}

/** Resolve a Marker id to its catalog facts, or `undefined` if it doesn't exist. */
export type MarkerLookup = (markerId: string) => MarkerInfo | undefined;

/**
 * Clamp a raw delta to a non-negative contribution bounded by the Marker weight.
 * The lower bound of 0 is what guarantees strength is monotonic — a negative or
 * NaN delta contributes nothing rather than subtracting (ADR-0004).
 */
export function clampContribution(delta: number, weight: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.min(delta, weight);
}

export interface ApplyResult {
  /** A new profile with the contributions added (the input is not mutated). */
  profile: StrengthProfile;
  /** The trace entries produced for this batch, in input order. */
  entries: ScoreTraceEntry[];
}

/**
 * Fold a batch of cited deltas into a Strength Profile, returning a new profile
 * and the trace entries for the batch. Deltas citing an unknown Marker id are
 * dropped (defense-in-depth: the agent is constrained to the catalog, ADR-0003)
 * — the returned profile and trace simply omit them. The Marker's catalog facts
 * are authoritative: the contribution lands on the Marker's own `tribeSlug` and
 * carries its `type`, regardless of what the payload claimed.
 */
export function applyDeltas(
  profile: StrengthProfile,
  deltas: readonly ScoreDelta[],
  opts: { turnIndex: number; lookup: MarkerLookup },
): ApplyResult {
  const next: StrengthProfile = { ...profile };
  const entries: ScoreTraceEntry[] = [];

  for (const delta of deltas) {
    const info = opts.lookup(delta.markerId);
    if (!info) continue; // unknown Marker — never invent a score for it

    const applied = clampContribution(delta.delta, info.weight);
    if (applied === 0) continue;

    next[info.tribeSlug] = (next[info.tribeSlug] ?? 0) + applied;
    entries.push({
      turnIndex: opts.turnIndex,
      markerId: delta.markerId,
      tribeSlug: info.tribeSlug,
      type: info.type,
      postureSignal: delta.postureSignal,
      applied,
    });
  }

  return { profile: next, entries };
}

/**
 * Normalize a Strength Profile to per-tribe display percentages that sum to ~100
 * (ADR-0002). This is cosmetic: the underlying strengths stay independent and
 * are not mutually exclusive — normalization is for the bars/headline only. An
 * all-zero profile (no scoring yet) normalizes to all zeros rather than dividing
 * by zero.
 */
export function normalizeProfile(profile: StrengthProfile): StrengthProfile {
  const total = Object.values(profile).reduce((sum, v) => sum + v, 0);
  const normalized: StrengthProfile = {};
  for (const [slug, value] of Object.entries(profile)) {
    normalized[slug] = total > 0 ? Math.round((value / total) * 100) : 0;
  }
  return normalized;
}

/**
 * The Primary tribe is the highest-strength one. Ties resolve to whichever slug
 * appears first in the profile's key order — which is canonical tribe order,
 * since the profile is seeded from `tribes` — so the result is deterministic.
 * Returns null only for an empty profile.
 */
export function derivePrimarySlug(profile: StrengthProfile): string | null {
  let bestSlug: string | null = null;
  let bestValue = -Infinity;
  for (const [slug, value] of Object.entries(profile)) {
    if (value > bestValue) {
      bestValue = value;
      bestSlug = slug;
    }
  }
  return bestSlug;
}
