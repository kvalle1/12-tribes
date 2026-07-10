import { describe, expect, it } from "vitest";

import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import { applyDeltas, toPercentages } from "./score";
import type { ScoreDelta, StrengthProfile } from "./types";

/** A fresh zeroed profile covering all 12 tribes, keyed by slug. */
function emptyProfile(): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  return profile;
}

/** Build a well-formed delta from a real catalog Marker (slug/type authoritative). */
function deltaFor(markerId: string, delta: number): ScoreDelta {
  const marker = getMarkerById(markerId);
  if (!marker) throw new Error(`test setup: unknown marker ${markerId}`);
  return {
    markerId,
    tribeSlug: marker.tribeSlug,
    type: marker.type,
    delta,
    postureSignal: "neutral",
  };
}

describe("applyDeltas", () => {
  it("adds a cited Marker's contribution to its tribe's strength", () => {
    const { profile } = applyDeltas(emptyProfile(), [deltaFor("judah-strength-front", 1)], 0);
    expect(profile.judah).toBe(1);
  });

  it("is additive: a shadow and a fall-line delta both raise strength (never lower it)", () => {
    // Both are non-strength types; ADR-0004 says they add to strength, never subtract.
    const { profile } = applyDeltas(
      emptyProfile(),
      [deltaFor("judah-shadow-insignificance", 2), deltaFor("judah-fall-power", 3)],
      0,
    );
    expect(profile.judah).toBe(5);
  });

  it("clamps a negative delta to a zero contribution (never lowers strength)", () => {
    const base = { ...emptyProfile(), judah: 4 };
    const { profile } = applyDeltas(base, [deltaFor("judah-strength-front", -3)], 0);
    expect(profile.judah).toBe(4);
  });

  it("ignores a non-finite delta rather than corrupting the tally", () => {
    const { profile } = applyDeltas(emptyProfile(), [deltaFor("levi-oil-access", NaN)], 0);
    expect(profile.levi).toBe(0);
  });

  it("does not mutate the input profile", () => {
    const base = emptyProfile();
    applyDeltas(base, [deltaFor("dan-strength-sentinel", 1)], 0);
    expect(base.dan).toBe(0);
  });

  it("drops a delta that cites an unknown Marker id (marker-constrained)", () => {
    const bogus: ScoreDelta = {
      markerId: "no-such-marker",
      tribeSlug: "judah",
      type: "strength",
      delta: 5,
      postureSignal: "neutral",
    };
    const { profile, trace } = applyDeltas(emptyProfile(), [bogus], 0);
    expect(profile.judah).toBe(0);
    expect(trace).toHaveLength(0);
  });

  it("drops a delta whose tribeSlug does not match the cited Marker", () => {
    const mismatched: ScoreDelta = {
      // judah-strength-front belongs to judah, not levi.
      markerId: "judah-strength-front",
      tribeSlug: "levi",
      type: "strength",
      delta: 5,
      postureSignal: "neutral",
    };
    const { profile, trace } = applyDeltas(emptyProfile(), [mismatched], 0);
    expect(profile.levi).toBe(0);
    expect(profile.judah).toBe(0);
    expect(trace).toHaveLength(0);
  });

  it("records a trace entry per applied delta: answer turn → Marker → before/after", () => {
    const { trace } = applyDeltas(
      { ...emptyProfile(), judah: 1 },
      [deltaFor("judah-strength-weight", 1)],
      3,
    );
    expect(trace).toEqual([
      {
        turnIndex: 3,
        markerId: "judah-strength-weight",
        tribeSlug: "judah",
        type: "strength",
        delta: 1,
        before: 1,
        after: 2,
        postureSignal: "neutral",
      },
    ]);
  });
});

describe("toPercentages", () => {
  it("normalizes to shares that sum to 100 while the underlying scores stay independent", () => {
    const profile = { ...emptyProfile(), judah: 3, levi: 1 };
    const pct = toPercentages(profile);
    const total = Object.values(pct).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100, 6);
    expect(pct.judah).toBeCloseTo(75, 6);
    expect(pct.levi).toBeCloseTo(25, 6);
    // Display normalization is cosmetic — the input profile is untouched.
    expect(profile.judah).toBe(3);
  });

  it("returns all-zero shares (no NaN) for an all-zero profile", () => {
    const pct = toPercentages(emptyProfile());
    for (const value of Object.values(pct)) expect(value).toBe(0);
  });
});
