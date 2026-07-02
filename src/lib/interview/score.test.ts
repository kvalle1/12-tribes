import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import {
  emptyProfile,
  rankedProfile,
  resolveDeltas,
  scoreTurn,
} from "./score";
import type { MarkerDelta } from "./types";

/**
 * External-behavior tests for the pure scoring engine (issue #16). We feed
 * agent-cited Marker deltas and assert the resulting Strength Profile, the
 * normalization, and the score trace — never internals.
 */

// Concrete Markers from the real catalog, with their catalogued weights.
const JUDAH_STRENGTH = "judah-strength-front"; // strength, weight 1
const JUDAH_SHADOW = "judah-shadow-insignificance"; // shadow, weight 2
const JUDAH_FALL = "judah-fall-power"; // fallLine, weight 3
const LEVI_STRENGTH = "levi-strength-guard"; // strength, weight 1

function delta(overrides: Partial<MarkerDelta> & { markerId: string }): MarkerDelta {
  const marker = getMarkerById(overrides.markerId);
  return {
    tribeSlug: marker?.tribeSlug ?? "judah",
    type: marker?.type ?? "strength",
    delta: 1,
    postureSignal: "neutral",
    ...overrides,
  };
}

describe("resolveDeltas", () => {
  it("drops deltas that cite a Marker id not in the catalog", () => {
    const resolved = resolveDeltas([
      delta({ markerId: JUDAH_STRENGTH }),
      delta({ markerId: "does-not-exist", tribeSlug: "judah", type: "strength" }),
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].markerId).toBe(JUDAH_STRENGTH);
  });

  it("trusts the catalog over the agent for tribe, type, and weight", () => {
    // Agent lies: claims this Judah strength Marker is a Levi fall-line.
    const [resolved] = resolveDeltas([
      delta({ markerId: JUDAH_STRENGTH, tribeSlug: "levi", type: "fallLine" }),
    ]);
    expect(resolved.tribeSlug).toBe("judah");
    expect(resolved.type).toBe("strength");
    expect(resolved.weight).toBe(1);
  });

  it("clamps intensity to [0,1] so a delta can never lower strength", () => {
    const [tooHigh] = resolveDeltas([delta({ markerId: JUDAH_STRENGTH, delta: 5 })]);
    const [negative] = resolveDeltas([delta({ markerId: JUDAH_STRENGTH, delta: -3 })]);
    expect(tooHigh.intensity).toBe(1);
    expect(negative.intensity).toBe(0);
    expect(negative.contribution).toBe(0);
  });

  it("computes contribution as intensity × the Marker's catalogued weight", () => {
    const [half] = resolveDeltas([delta({ markerId: JUDAH_FALL, delta: 0.5 })]);
    expect(half.weight).toBe(3);
    expect(half.contribution).toBeCloseTo(1.5);
  });
});

describe("scoreTurn", () => {
  it("adds a strength delta to the cited tribe's running score", () => {
    const { profile } = scoreTurn(
      { profile: emptyProfile(), trace: [] },
      { question: "q", answer: "a", deltas: [delta({ markerId: JUDAH_STRENGTH })] },
    );
    expect(profile.judah).toBeCloseTo(1);
  });

  it("treats a shadow delta as additive — it never lowers strength (ADR-0004)", () => {
    const start = { ...emptyProfile(), judah: 2 };
    const { profile } = scoreTurn(
      { profile: start, trace: [] },
      { question: "q", answer: "a", deltas: [delta({ markerId: JUDAH_SHADOW, delta: 1 })] },
    );
    expect(profile.judah).toBeGreaterThan(2);
    expect(profile.judah).toBeCloseTo(2 + 2); // shadow weight 2
  });

  it("treats a matured fall-line delta as additive — resonance is evidence (ADR-0004)", () => {
    const start = { ...emptyProfile(), judah: 1 };
    const { profile } = scoreTurn(
      { profile: start, trace: [] },
      { question: "q", answer: "a", deltas: [delta({ markerId: JUDAH_FALL, delta: 1 })] },
    );
    expect(profile.judah).toBeGreaterThan(1); // never decreases
    expect(profile.judah).toBeCloseTo(1 + 3); // fall-line weight 3
  });

  it("keeps tribe scores independent — one tribe's delta doesn't touch another", () => {
    const { profile } = scoreTurn(
      { profile: emptyProfile(), trace: [] },
      { question: "q", answer: "a", deltas: [delta({ markerId: JUDAH_STRENGTH })] },
    );
    expect(profile.levi).toBe(0);
  });

  it("records a trace entry with the answer and every applied Marker (ADR-0003)", () => {
    const { trace } = scoreTurn(
      { profile: emptyProfile(), trace: [] },
      {
        question: "What drives you?",
        answer: "I step to the front.",
        deltas: [delta({ markerId: JUDAH_STRENGTH }), delta({ markerId: LEVI_STRENGTH })],
      },
    );
    expect(trace).toHaveLength(1);
    expect(trace[0].answer).toBe("I step to the front.");
    expect(trace[0].applied.map((a) => a.markerId)).toEqual([
      JUDAH_STRENGTH,
      LEVI_STRENGTH,
    ]);
  });

  it("does not mutate the input profile", () => {
    const start = emptyProfile();
    scoreTurn(
      { profile: start, trace: [] },
      { question: "q", answer: "a", deltas: [delta({ markerId: JUDAH_STRENGTH })] },
    );
    expect(start.judah).toBe(0);
  });
});

describe("rankedProfile", () => {
  it("returns all 12 tribes sorted by raw score, highest first", () => {
    const profile = { ...emptyProfile(), levi: 3, judah: 5 };
    const ranked = rankedProfile(profile);
    expect(ranked).toHaveLength(tribes.length);
    expect(ranked[0].slug).toBe("judah");
    expect(ranked[1].slug).toBe("levi");
  });

  it("normalizes percentages to sum to 100 when any strength is present", () => {
    const profile = { ...emptyProfile(), judah: 3, levi: 1 };
    const ranked = rankedProfile(profile);
    const total = ranked.reduce((sum, t) => sum + t.percentage, 0);
    expect(total).toBeCloseTo(100);
    expect(ranked[0].percentage).toBeCloseTo(75);
  });

  it("yields all-zero percentages (no NaN) for an empty profile", () => {
    const ranked = rankedProfile(emptyProfile());
    expect(ranked.every((t) => t.percentage === 0)).toBe(true);
  });
});
