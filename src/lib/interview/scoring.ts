import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import type {
  InterviewState,
  MarkerDelta,
  NormalizedProfile,
  PostureProfile,
  StrengthProfile,
} from "./types";

/**
 * The pure Interview scoring engine (ADRs 0002 / 0003 / 0004).
 *
 * The Marker-constrained scoring model (ADR 0003) says every strength delta the
 * agent assigns must cite a catalogued Marker with a bounded weight. This module
 * is the enforcement point: it validates each `MarkerDelta` against the Marker
 * Catalog, caps its magnitude, and folds it into the running Strength Profile
 * and Posture tallies. The interpreter (`interpreter.ts`) may return anything;
 * only what survives this validator moves scores.
 *
 * The invariant that makes fall-line and shadow scoring safe (ADR 0004): every
 * delta is **additive on strength**. Someone who has matured past a fall-line
 * still resonates with its theme — that resonance is evidence *of* the tribe,
 * not against it. Their Posture moves toward *integrated* (via
 * `postureSignal: +1`), never their strength downward. Anyone "fixing" the
 * validator to subtract shadow/fall-line contributions is reintroducing the
 * confound this file exists to prevent.
 *
 * Kept pure and dependency-free from the DB/LLM layers so its behavior is
 * unit-testable end-to-end (ADRs 0009/0010: the instrument's rigor is here, not
 * in the prompt).
 */

/**
 * The most any single delta may contribute, expressed as a multiplier of the
 * cited Marker's own weight. Bounds the blast radius of a single hallucinated
 * over-large delta while still letting the interpreter mark unusually strong
 * resonance as slightly above baseline.
 */
export const MAX_DELTA_MULTIPLIER = 2;

/** How much a `postureSignal` of ±1 shifts a tribe's Posture tally per Turn. */
export const POSTURE_STEP = 1;

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

/** Fresh zeroed Strength Profile keyed by every tribe slug. */
export function emptyStrengthProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  return profile;
}

/** Fresh zeroed Posture Profile keyed by every tribe slug. */
export function emptyPosture(): PostureProfile {
  const posture: PostureProfile = {};
  for (const tribe of tribes) posture[tribe.slug] = 0;
  return posture;
}

/**
 * Validate `deltas` against the Marker Catalog and fold each surviving delta
 * into a *new* profile / posture pair (no mutation).
 *
 * Every delta is checked in isolation: the cited Marker must exist, the
 * `tribeSlug` and `type` must match what the catalog authored, and the `delta`
 * must be non-negative — a negative delta is a bug, not a signal we can shrug
 * off (silently zeroing it would let a subtractive-strength attempt sneak past
 * the ADR 0004 invariant). Magnitude is capped at `MAX_DELTA_MULTIPLIER ×
 * Marker.weight` so a single over-large hallucination cannot swamp the score.
 */
export function validateAndApplyDeltas(
  profile: StrengthProfile,
  posture: PostureProfile,
  deltas: readonly MarkerDelta[],
): { profile: StrengthProfile; posture: PostureProfile } {
  const nextProfile: StrengthProfile = { ...profile };
  const nextPosture: PostureProfile = { ...posture };

  for (const d of deltas) {
    const marker = getMarkerById(d.markerId);
    if (!marker) {
      throw new ScoringError(
        `Delta cites Marker "${d.markerId}" which is not in the catalog.`,
      );
    }
    if (marker.tribeSlug !== d.tribeSlug || marker.type !== d.type) {
      throw new ScoringError(
        `Delta contradicts Marker "${d.markerId}": ` +
          `expected ${marker.tribeSlug}/${marker.type}, ` +
          `got ${d.tribeSlug}/${d.type}.`,
      );
    }
    if (typeof d.delta !== "number" || Number.isNaN(d.delta)) {
      throw new ScoringError(
        `Delta for Marker "${d.markerId}" is not a number.`,
      );
    }
    if (d.delta < 0) {
      throw new ScoringError(
        `Delta for Marker "${d.markerId}" is negative (${d.delta}); ` +
          `fall-line and shadow Markers are additive on strength (ADR 0004).`,
      );
    }

    const cap = marker.weight * MAX_DELTA_MULTIPLIER;
    const applied = Math.min(d.delta, cap);
    nextProfile[d.tribeSlug] = (nextProfile[d.tribeSlug] ?? 0) + applied;

    const signal: -1 | 0 | 1 = d.postureSignal ?? 0;
    if (signal !== 0) {
      nextPosture[d.tribeSlug] =
        (nextPosture[d.tribeSlug] ?? 0) + signal * POSTURE_STEP;
    }
  }

  return { profile: nextProfile, posture: nextPosture };
}

/**
 * Normalize a Strength Profile to display shares (ADR 0002). Shares are
 * cosmetic — the underlying scores are independent per-tribe axes, not a
 * probability distribution — but sharing "% of total evidence" is a legible
 * display, and it's what result views consume.
 *
 * An all-zeros profile returns share=0 for every tribe (rather than dividing by
 * zero) so an empty state renders sensibly.
 */
export function normalizeProfile(profile: StrengthProfile): NormalizedProfile {
  const entries = tribes.map((t) => ({
    slug: t.slug,
    score: profile[t.slug] ?? 0,
  }));
  const total = entries.reduce((s, e) => s + e.score, 0);
  return {
    entries: entries.map(({ slug, score }) => ({
      slug,
      score,
      share: total > 0 ? score / total : 0,
    })),
  };
}

/**
 * Fold a scored answer into the Interview state: append the Turn (with its
 * deltas kept, so the score trace is durable), apply the deltas, and return the
 * next state. Refuses to run without a persisted `currentQuestion` — that would
 * mean we scored an answer we cannot attribute to a question.
 */
export function applyScoredTurn(
  state: InterviewState,
  answer: string,
  deltas: readonly MarkerDelta[],
): InterviewState {
  if (!state.currentQuestion) {
    throw new ScoringError(
      "Cannot apply a scored Turn: the Session has no current question.",
    );
  }
  const { profile, posture } = validateAndApplyDeltas(
    state.profile,
    state.posture,
    deltas,
  );
  return {
    ...state,
    profile,
    posture,
    turns: [
      ...state.turns,
      {
        question: state.currentQuestion,
        answer,
        scored: [...deltas],
      },
    ],
  };
}
