import { describe, expect, it } from "vitest";

import { getMarkerById } from "@/lib/interview/markers";
import {
  applyScoring,
  normalizeProfile,
  parseScoringPayload,
  ScoringError,
} from "@/lib/interview/scoring";
import type { ScoredDelta } from "@/lib/interview/types";

// Real catalogued Markers used across the cases (weights: strength 1, oil 2,
// shadow 2, fallLine 3).
const JUDAH_STRENGTH = "judah-strength-front"; // strength, weight 1
const JUDAH_SHADOW = "judah-shadow-insignificance"; // shadow, weight 2
const JUDAH_FALL = "judah-fall-power"; // fallLine, weight 3
const LEVI_OIL = "levi-oil-access"; // oil, weight 2

const emptyBase = () => ({ profile: {}, posture: {}, trace: [] });

describe("parseScoringPayload", () => {
  it("accepts a well-formed payload citing real Markers", () => {
    const deltas = parseScoringPayload([
      {
        markerId: JUDAH_STRENGTH,
        tribeSlug: "judah",
        type: "strength",
        delta: 1,
        postureSignal: 0.5,
      },
    ]);
    expect(deltas).toEqual<ScoredDelta[]>([
      {
        markerId: JUDAH_STRENGTH,
        tribeSlug: "judah",
        type: "strength",
        delta: 1,
        postureSignal: 0.5,
      },
    ]);
  });

  it("rejects a payload that is not an array", () => {
    expect(() => parseScoringPayload({})).toThrow(ScoringError);
  });

  it("rejects a delta citing an unknown Marker id (ADR-0003 gate)", () => {
    expect(() =>
      parseScoringPayload([
        {
          markerId: "not-a-real-marker",
          tribeSlug: "judah",
          type: "strength",
          delta: 1,
          postureSignal: 0,
        },
      ]),
    ).toThrow(/unknown Marker id/);
  });

  it("rejects a delta whose tribeSlug contradicts the cited Marker", () => {
    expect(() =>
      parseScoringPayload([
        {
          markerId: JUDAH_STRENGTH,
          tribeSlug: "levi",
          type: "strength",
          delta: 1,
          postureSignal: 0,
        },
      ]),
    ).toThrow(/belongs to judah/);
  });

  it("rejects a delta whose type contradicts the cited Marker", () => {
    expect(() =>
      parseScoringPayload([
        {
          markerId: JUDAH_STRENGTH,
          tribeSlug: "judah",
          type: "shadow",
          delta: 1,
          postureSignal: 0,
        },
      ]),
    ).toThrow(/Marker is strength/);
  });

  it("rejects a non-finite delta", () => {
    expect(() =>
      parseScoringPayload([
        {
          markerId: JUDAH_STRENGTH,
          tribeSlug: "judah",
          type: "strength",
          delta: Number.NaN,
          postureSignal: 0,
        },
      ]),
    ).toThrow(/non-finite delta/);
  });

  it("clamps delta into [0, marker.weight] so a hallucinated magnitude can't blow up the profile", () => {
    const weight = getMarkerById(JUDAH_FALL)!.weight; // 3
    const [tooBig] = parseScoringPayload([
      {
        markerId: JUDAH_FALL,
        tribeSlug: "judah",
        type: "fallLine",
        delta: 999,
        postureSignal: 0,
      },
    ]);
    expect(tooBig.delta).toBe(weight);

    const [negative] = parseScoringPayload([
      {
        markerId: JUDAH_FALL,
        tribeSlug: "judah",
        type: "fallLine",
        delta: -5,
        postureSignal: 0,
      },
    ]);
    expect(negative.delta).toBe(0);
  });

  it("clamps postureSignal into [-1, 1]", () => {
    const [d] = parseScoringPayload([
      {
        markerId: JUDAH_SHADOW,
        tribeSlug: "judah",
        type: "shadow",
        delta: 1,
        postureSignal: -4,
      },
    ]);
    expect(d.postureSignal).toBe(-1);
  });
});

describe("applyScoring", () => {
  it("adds strength deltas to the running profile and records a trace entry per delta", () => {
    const deltas = parseScoringPayload([
      { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1, postureSignal: 0.4 },
      { markerId: LEVI_OIL, tribeSlug: "levi", type: "oil", delta: 2, postureSignal: 0.8 },
    ]);
    const { profile, trace } = applyScoring(emptyBase(), 0, deltas);

    expect(profile.judah).toBe(1);
    expect(profile.levi).toBe(2);
    expect(trace).toHaveLength(2);
    expect(trace[0]).toEqual({
      turnIndex: 0,
      markerId: JUDAH_STRENGTH,
      tribeSlug: "judah",
      type: "strength",
      delta: 1,
      postureSignal: 0.4,
    });
  });

  it("treats shadow and fall-line deltas as additive — they raise strength, never lower it (ADR-0004)", () => {
    // Start with some earned strength, then apply shadow + fall-line resonance.
    const base = applyScoring(
      emptyBase(),
      0,
      parseScoringPayload([
        { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1, postureSignal: 0.2 },
      ]),
    );
    const before = base.profile.judah;

    const after = applyScoring(
      base,
      1,
      parseScoringPayload([
        { markerId: JUDAH_SHADOW, tribeSlug: "judah", type: "shadow", delta: 2, postureSignal: -1 },
        { markerId: JUDAH_FALL, tribeSlug: "judah", type: "fallLine", delta: 3, postureSignal: -1 },
      ]),
    );

    expect(after.profile.judah).toBeGreaterThan(before);
    expect(after.profile.judah).toBe(before + 2 + 3);
  });

  it("moves posture independently of strength (orthogonal axes)", () => {
    const { profile, posture } = applyScoring(
      emptyBase(),
      0,
      parseScoringPayload([
        { markerId: JUDAH_SHADOW, tribeSlug: "judah", type: "shadow", delta: 2, postureSignal: -1 },
      ]),
    );
    // Strength went up even though posture went toward active-shadow.
    expect(profile.judah).toBe(2);
    expect(posture.judah).toBe(-1);
  });

  it("does not mutate the input state", () => {
    const base = emptyBase();
    applyScoring(
      base,
      0,
      parseScoringPayload([
        { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1, postureSignal: 0 },
      ]),
    );
    expect(base.profile).toEqual({});
    expect(base.posture).toEqual({});
    expect(base.trace).toEqual([]);
  });

  it("accumulates across turns", () => {
    const t0 = applyScoring(
      emptyBase(),
      0,
      parseScoringPayload([
        { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1, postureSignal: 0 },
      ]),
    );
    const t1 = applyScoring(
      t0,
      1,
      parseScoringPayload([
        { markerId: JUDAH_STRENGTH, tribeSlug: "judah", type: "strength", delta: 1, postureSignal: 0 },
      ]),
    );
    expect(t1.profile.judah).toBe(2);
    expect(t1.trace.map((e) => e.turnIndex)).toEqual([0, 1]);
  });
});

describe("normalizeProfile", () => {
  it("projects independent strengths onto percentages that sum to ~100", () => {
    const pct = normalizeProfile({ judah: 3, levi: 1 });
    expect(pct.judah).toBeCloseTo(75);
    expect(pct.levi).toBeCloseTo(25);
    const sum = Object.values(pct).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100);
  });

  it("normalizes an all-zero profile to all zeros rather than dividing by zero", () => {
    const pct = normalizeProfile({ judah: 0, levi: 0 });
    expect(pct).toEqual({ judah: 0, levi: 0 });
  });

  it("keeps the underlying profile independent (input is not a distribution)", () => {
    const profile = { judah: 3, levi: 1 };
    normalizeProfile(profile);
    expect(profile).toEqual({ judah: 3, levi: 1 });
  });
});
