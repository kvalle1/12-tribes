import { describe, expect, it } from "vitest";
import {
  applyDeltas,
  derivePosture,
  derivePostureProfile,
  derivePostureReadings,
  normalize,
} from "./scoring";
import type { MarkerDelta, ScoreTraceEntry } from "./types";

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
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
      2,
    );
    expect(trace).toEqual([
      {
        turnIndex: 2,
        markerId: "judah-fall-power",
        tribeSlug: "judah",
        type: "fallLine",
        delta: 3,
        postureSignal: "integrated",
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

// A stub resolver standing in for the Marker Catalog's one-oil-per-tribe lookup,
// so the routing is tested without depending on the real catalog.
const oilFor = (slug: string): string | undefined =>
  slug === "unknown" ? undefined : `${slug}-oil`;

describe("applyDeltas — matured fall-line → oil routing (ADR-0004)", () => {
  it("routes a matured (integrated) fall-line to the tribe's oil Marker in the trace", () => {
    const { trace } = applyDeltas(
      { simeon: 0 },
      [d("simeon-fall-wrath", "simeon", "fallLine", 3, "integrated")],
      1,
      oilFor,
    );
    expect(trace).toEqual([
      {
        turnIndex: 1,
        markerId: "simeon-oil",
        tribeSlug: "simeon",
        type: "oil",
        delta: 3,
        postureSignal: "integrated",
        routedFrom: "simeon-fall-wrath",
      },
    ]);
  });

  it("does not set routedFrom on an un-routed delta", () => {
    const { trace } = applyDeltas(
      { judah: 0 },
      [d("judah-strength-front", "judah", "strength", 1)],
      0,
      oilFor,
    );
    expect(trace[0]).not.toHaveProperty("routedFrom");
  });

  it("still credits the routed contribution to strength — maturity never lowers it", () => {
    const { profile } = applyDeltas(
      { simeon: 2 },
      [d("simeon-fall-wrath", "simeon", "fallLine", 3, "integrated")],
      0,
      oilFor,
    );
    // Full fall-line magnitude (3) is added, not re-capped to the oil weight.
    expect(profile.simeon).toBe(5);
  });

  it("does not route a fall-line that is still active-shadow (not matured)", () => {
    const { trace } = applyDeltas(
      { simeon: 0 },
      [d("simeon-fall-wrath", "simeon", "fallLine", 3, "active-shadow")],
      0,
      oilFor,
    );
    expect(trace[0]).toMatchObject({ markerId: "simeon-fall-wrath", type: "fallLine" });
  });

  it("does not route a non-fall-line Marker even when it reads integrated", () => {
    const { trace } = applyDeltas(
      { simeon: 0 },
      [d("simeon-shadow-zeal", "simeon", "shadow", 2, "integrated")],
      0,
      oilFor,
    );
    expect(trace[0]).toMatchObject({ markerId: "simeon-shadow-zeal", type: "shadow" });
  });

  it("leaves the fall-line Marker in place when no oil Marker resolves", () => {
    const { trace } = applyDeltas(
      { unknown: 0 },
      [d("x-fall", "unknown", "fallLine", 3, "integrated")],
      0,
      oilFor,
    );
    expect(trace[0]).toMatchObject({ markerId: "x-fall", type: "fallLine" });
  });
});

const t = (
  tribeSlug: string,
  delta: number,
  postureSignal: ScoreTraceEntry["postureSignal"],
): ScoreTraceEntry => ({
  turnIndex: 0,
  markerId: "m",
  tribeSlug,
  type: "strength",
  delta,
  postureSignal,
});

describe("derivePostureProfile", () => {
  it("tallies integrated and active-shadow evidence per tribe, weighted by delta", () => {
    const posture = derivePostureProfile([
      t("judah", 3, "integrated"),
      t("judah", 1, "active-shadow"),
      t("levi", 2, "active-shadow"),
    ]);
    expect(posture.judah).toEqual({ integrated: 3, activeShadow: 1 });
    expect(posture.levi).toEqual({ integrated: 0, activeShadow: 2 });
  });

  it("does not tally neutral (non-posture-bearing) evidence", () => {
    const posture = derivePostureProfile([t("judah", 3, "neutral")]);
    expect(posture.judah).toEqual({ integrated: 0, activeShadow: 0 });
  });
});

describe("derivePosture", () => {
  it("reads unknown when there is no posture-bearing evidence", () => {
    expect(derivePosture(undefined)).toBe("unknown");
    expect(derivePosture({ integrated: 0, activeShadow: 0 })).toBe("unknown");
  });

  it("reads integrated when integrated evidence dominates", () => {
    expect(derivePosture({ integrated: 3, activeShadow: 0 })).toBe("integrated");
  });

  it("reads active-shadow when shadow evidence dominates", () => {
    expect(derivePosture({ integrated: 0, activeShadow: 3 })).toBe("active-shadow");
  });

  it("reads mixed when evidence pulls both ways within the dominance band", () => {
    expect(derivePosture({ integrated: 2, activeShadow: 2 })).toBe("mixed");
  });
});

describe("derivePostureReadings", () => {
  it("forces a reading for every requested slug, defaulting to unknown", () => {
    const readings = derivePostureReadings([t("judah", 3, "integrated")], [
      "judah",
      "levi",
    ]);
    expect(readings).toEqual({ judah: "integrated", levi: "unknown" });
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
