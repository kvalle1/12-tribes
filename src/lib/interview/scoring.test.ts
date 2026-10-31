import { describe, expect, it } from "vitest";
import { applyDeltas, normalize, posturePosition } from "./scoring";
import type { MarkerDelta, PostureTally } from "./types";

const d = (
  markerId: string,
  tribeSlug: string,
  type: MarkerDelta["type"],
  delta: number,
  postureSignal: MarkerDelta["postureSignal"] = "neutral",
): MarkerDelta => ({ markerId, tribeSlug, type, delta, postureSignal });

describe("applyDeltas", () => {
  it("adds a strength delta to the cited tribe", () => {
    const { profile } = applyDeltas({ judah: 0, levi: 0 }, [d("m1", "judah", "strength", 2)], 0);
    expect(profile.judah).toBe(2);
    expect(profile.levi).toBe(0);
  });

  it("accumulates multiple deltas onto the running profile", () => {
    const { profile } = applyDeltas(
      { judah: 3, levi: 1 },
      [d("m1", "judah", "strength", 2), d("m2", "levi", "oil", 1)],
      0,
    );
    expect(profile.judah).toBe(5);
    expect(profile.levi).toBe(2);
  });

  it("does not mutate the input profile", () => {
    const before = { judah: 0, levi: 0 };
    applyDeltas(before, [d("m1", "judah", "strength", 2)], 0);
    expect(before).toEqual({ judah: 0, levi: 0 });
  });

  it("treats a shadow delta as additive — it raises, never lowers, strength (ADR-0004)", () => {
    const { profile } = applyDeltas({ judah: 4 }, [d("m1", "judah", "shadow", 2)], 0);
    expect(profile.judah).toBe(6);
  });

  it("never lets a negative shadow delta lower strength (the matured-fall confound)", () => {
    const { profile } = applyDeltas({ judah: 4 }, [d("m1", "judah", "shadow", -3)], 0);
    expect(profile.judah).toBe(4);
  });

  it("never lets a negative fall-line delta lower strength", () => {
    const { profile } = applyDeltas({ simeon: 2 }, [d("m1", "simeon", "fallLine", -5)], 0);
    expect(profile.simeon).toBe(2);
  });

  it("records a trace entry per applied delta, tied to the Turn index and Marker", () => {
    // A non-matured fall-line (neutral posture) is recorded as-is; the
    // matured-fall-line → oil routing is exercised separately below.
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "neutral")],
      2,
    );
    expect(trace).toEqual([
      {
        turnIndex: 2,
        markerId: "judah-fall-power",
        tribeSlug: "judah",
        type: "fallLine",
        delta: 3,
        postureSignal: "neutral",
      },
    ]);
  });

  it("records the applied (clamped) delta in the trace, not the raw negative", () => {
    const { trace } = applyDeltas({ judah: 1 }, [d("m1", "judah", "shadow", -3)], 0);
    expect(trace[0].delta).toBe(0);
  });

  it("ignores a delta for a tribe not already in the profile shape", () => {
    // The running profile is seeded with all 12 tribes; a slug outside it is a
    // validation miss and must not silently introduce a new key.
    const { profile } = applyDeltas({ judah: 0 }, [d("m1", "unknown", "strength", 2)], 0);
    expect(profile).toEqual({ judah: 0 });
    expect(Object.keys(profile)).toEqual(["judah"]);
  });
});

describe("applyDeltas — Posture axis (ADR-0004)", () => {
  it("counts an integrated signal toward the tribe's integrated posture", () => {
    const { posture } = applyDeltas(
      { judah: 0 },
      [d("m1", "judah", "strength", 2, "integrated")],
      0,
    );
    expect(posture.judah).toEqual({ integrated: 1, activeShadow: 0 });
  });

  it("counts an active-shadow signal toward the tribe's active-shadow posture", () => {
    const { posture } = applyDeltas(
      { judah: 0 },
      [d("m1", "judah", "shadow", 2, "active-shadow")],
      0,
    );
    expect(posture.judah).toEqual({ integrated: 0, activeShadow: 1 });
  });

  it("leaves Posture untouched for a neutral signal (strength only)", () => {
    const { profile, posture } = applyDeltas(
      { judah: 0 },
      [d("m1", "judah", "strength", 2, "neutral")],
      0,
    );
    expect(profile.judah).toBe(2);
    expect(posture.judah).toEqual({ integrated: 0, activeShadow: 0 });
  });

  it("accumulates Posture onto a prior tally without mutating the input", () => {
    const before = { judah: { integrated: 1, activeShadow: 2 } };
    const { posture } = applyDeltas(
      { judah: 0 },
      [d("m1", "judah", "strength", 1, "integrated")],
      0,
      { posture: before },
    );
    expect(posture.judah).toEqual({ integrated: 2, activeShadow: 2 });
    expect(before.judah).toEqual({ integrated: 1, activeShadow: 2 });
  });

  it("routes a matured fall-line to the tribe's oil Marker in the trace", () => {
    // A fall-line scored with an integrated posture is maturity around the
    // tendency: the evidence is re-attributed to the tribe's oil Marker, which
    // cross-confirms via a different Marker type (ADR-0004).
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      0,
      { oilMarkerFor: (slug) => (slug === "judah" ? "judah-oil-responsibility" : undefined) },
    );
    expect(trace[0].type).toBe("oil");
    expect(trace[0].markerId).toBe("judah-oil-responsibility");
  });

  it("a matured fall-line shifts Posture toward integrated without reducing strength", () => {
    const { profile, posture } = applyDeltas(
      { judah: 4 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      0,
      { oilMarkerFor: () => "judah-oil-responsibility" },
    );
    expect(profile.judah).toBe(7); // additive: 4 + 3, never lowered
    expect(posture.judah).toEqual({ integrated: 1, activeShadow: 0 });
  });

  it("leaves a fall-line that is NOT matured (active-shadow) as a fall-line", () => {
    const { trace, posture } = applyDeltas(
      { simeon: 0 },
      [d("simeon-fall-cruelty", "simeon", "fallLine", 3, "active-shadow")],
      0,
      { oilMarkerFor: () => "simeon-oil-mercy" },
    );
    expect(trace[0].type).toBe("fallLine");
    expect(trace[0].markerId).toBe("simeon-fall-cruelty");
    expect(posture.simeon).toEqual({ integrated: 0, activeShadow: 1 });
  });

  it("keeps the original markerId when no oil-Marker resolver is supplied", () => {
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      0,
    );
    // Still re-typed as oil (routing of the evidence type), but with no catalog
    // to resolve the oil Marker id the original citation is retained.
    expect(trace[0].type).toBe("oil");
    expect(trace[0].markerId).toBe("judah-fall-power");
  });
});

describe("posturePosition", () => {
  const read = (integrated: number, activeShadow: number): PostureTally => ({
    integrated,
    activeShadow,
  });

  it("reads a tally with no evidence as unknown", () => {
    expect(posturePosition(read(0, 0)).reading).toBe("unknown");
    expect(posturePosition(undefined).reading).toBe("unknown");
  });

  it("reads a clearly integrated tally as integrated", () => {
    expect(posturePosition(read(3, 0)).reading).toBe("integrated");
  });

  it("reads a clearly active-shadow tally as active-shadow", () => {
    expect(posturePosition(read(0, 3)).reading).toBe("active-shadow");
  });

  it("reads an evenly split tally as mixed", () => {
    expect(posturePosition(read(2, 2)).reading).toBe("mixed");
  });

  it("scores from -1 (all active-shadow) to +1 (all integrated)", () => {
    expect(posturePosition(read(4, 0)).score).toBeCloseTo(1);
    expect(posturePosition(read(0, 4)).score).toBeCloseTo(-1);
    expect(posturePosition(read(2, 2)).score).toBeCloseTo(0);
  });
});

describe("normalize", () => {
  it("returns per-tribe shares that sum to 100, proportional to the raw scores", () => {
    const pct = normalize({ a: 3, b: 1 });
    expect(pct.a).toBeCloseTo(75);
    expect(pct.b).toBeCloseTo(25);
    expect(pct.a + pct.b).toBeCloseTo(100);
  });

  it("returns all zeros when every score is zero (no divide-by-zero)", () => {
    const pct = normalize({ a: 0, b: 0, c: 0 });
    expect(pct).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("does not mutate the underlying independent scores", () => {
    const raw = { a: 3, b: 1 };
    normalize(raw);
    expect(raw).toEqual({ a: 3, b: 1 });
  });

  it("keeps a tribe with no evidence at 0%", () => {
    const pct = normalize({ a: 4, b: 0 });
    expect(pct.a).toBeCloseTo(100);
    expect(pct.b).toBe(0);
  });
});
