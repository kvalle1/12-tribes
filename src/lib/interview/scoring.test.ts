import { describe, expect, it } from "vitest";
import { accumulatePosture, applyDeltas, normalize } from "./scoring";
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

  describe("matured fall-line → oil routing (ADR-0004)", () => {
    // A resolver standing in for the Marker Catalog: the oil Marker for a tribe.
    const oilFor = (slug: string) => (slug === "judah" ? "judah-oil-x" : undefined);

    it("re-attributes a matured (integrated) fall-line delta to the tribe's oil Marker", () => {
      const { trace } = applyDeltas(
        { judah: 0 },
        [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
        0,
        oilFor,
      );
      expect(trace[0].markerId).toBe("judah-oil-x");
      expect(trace[0].type).toBe("oil");
      expect(trace[0].postureSignal).toBe("integrated");
    });

    it("still adds the full fall-line strength when routing to oil — never reduces strength", () => {
      const { profile } = applyDeltas(
        { judah: 4 },
        [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
        0,
        oilFor,
      );
      expect(profile.judah).toBe(7);
    });

    it("leaves a non-matured (active-shadow) fall-line delta attributed to its fall-line Marker", () => {
      const { trace } = applyDeltas(
        { judah: 0 },
        [d("judah-fall-power", "judah", "fallLine", 3, "active-shadow")],
        0,
        oilFor,
      );
      expect(trace[0].markerId).toBe("judah-fall-power");
      expect(trace[0].type).toBe("fallLine");
    });

    it("does not route an integrated fall-line when no oil Marker exists for the tribe", () => {
      const { trace } = applyDeltas(
        { levi: 0 },
        [d("levi-fall-x", "levi", "fallLine", 3, "integrated")],
        0,
        oilFor,
      );
      expect(trace[0].markerId).toBe("levi-fall-x");
      expect(trace[0].type).toBe("fallLine");
    });

    it("does not route when no resolver is supplied (back-compat)", () => {
      const { trace } = applyDeltas(
        { judah: 0 },
        [d("judah-fall-power", "judah", "fallLine", 3, "integrated")],
        0,
      );
      expect(trace[0].markerId).toBe("judah-fall-power");
      expect(trace[0].type).toBe("fallLine");
    });
  });
});

describe("accumulatePosture", () => {
  const t = (
    tribeSlug: string,
    delta: number,
    postureSignal: ScoreTraceEntry["postureSignal"],
    type: ScoreTraceEntry["type"] = "strength",
  ): ScoreTraceEntry => ({ turnIndex: 0, markerId: "m", tribeSlug, type, delta, postureSignal });

  it("has no reading for a tribe with no trace entries", () => {
    expect(accumulatePosture([])).toEqual({});
  });

  it("leans integrated when integrated evidence outweighs active-shadow", () => {
    const posture = accumulatePosture([
      t("judah", 3, "integrated"),
      t("judah", 1, "active-shadow"),
    ]);
    expect(posture.judah.integrated).toBe(3);
    expect(posture.judah.activeShadow).toBe(1);
    expect(posture.judah.net).toBe(2);
    expect(posture.judah.arc).toBe("integrated");
  });

  it("leans active-shadow when active-shadow evidence outweighs integrated", () => {
    const posture = accumulatePosture([
      t("simeon", 1, "integrated"),
      t("simeon", 3, "active-shadow"),
    ]);
    expect(posture.simeon.net).toBe(-2);
    expect(posture.simeon.arc).toBe("active-shadow");
  });

  it("reads neutral when posture-bearing evidence is balanced", () => {
    const posture = accumulatePosture([
      t("dan", 2, "integrated"),
      t("dan", 2, "active-shadow"),
    ]);
    expect(posture.dan.arc).toBe("neutral");
  });

  it("weights posture by evidence strength, not by number of signals", () => {
    // One heavy integrated signal outweighs two light active-shadow ones.
    const posture = accumulatePosture([
      t("judah", 3, "integrated"),
      t("judah", 1, "active-shadow"),
      t("judah", 1, "active-shadow"),
    ]);
    expect(posture.judah.arc).toBe("integrated");
  });

  it("ignores neutral signals so a tribe scored only neutrally reads neutral", () => {
    const posture = accumulatePosture([t("asher", 2, "neutral"), t("asher", 1, "neutral")]);
    expect(posture.asher).toEqual({ integrated: 0, activeShadow: 0, net: 0, arc: "neutral" });
  });

  it("reflects the matured-fall-line routing: an integrated routed delta shifts posture toward integrated", () => {
    // What applyDeltas produces for a matured fall-line routed to oil.
    const { trace } = applyDeltas(
      { judah: 0 },
      [{ markerId: "judah-fall-power", tribeSlug: "judah", type: "fallLine", delta: 3, postureSignal: "integrated" }],
      0,
      (slug) => (slug === "judah" ? "judah-oil-x" : undefined),
    );
    const posture = accumulatePosture(trace);
    expect(posture.judah.arc).toBe("integrated");
    expect(posture.judah.integrated).toBe(3);
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
