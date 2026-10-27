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
      [d("judah-fall-power", "judah", "fallLine", 3, "active-shadow")],
      2,
    );
    expect(trace).toEqual([
      {
        turnIndex: 2,
        markerId: "judah-fall-power",
        tribeSlug: "judah",
        type: "fallLine",
        delta: 3,
        postureSignal: "active-shadow",
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

describe("applyDeltas — matured fall-line routing (ADR-0004)", () => {
  const matured = d("judah-fall-power", "judah", "fallLine", 3, "integrated");

  it("routes a matured fall-line to the tribe's oil Marker", () => {
    const { trace } = applyDeltas({ judah: 0 }, [matured], 1);
    expect(trace).toEqual([
      {
        turnIndex: 1,
        markerId: "judah-oil-responsibility",
        tribeSlug: "judah",
        type: "oil",
        delta: 3,
        postureSignal: "integrated",
        routedFrom: "judah-fall-power",
      },
    ]);
  });

  it("never reduces strength when routing — the full fall-line delta still counts", () => {
    const active = applyDeltas({ judah: 2 }, [d("judah-fall-power", "judah", "fallLine", 3, "active-shadow")], 0);
    const routed = applyDeltas({ judah: 2 }, [matured], 0);
    expect(routed.profile.judah).toBe(5);
    expect(routed.profile.judah).toBe(active.profile.judah);
  });

  it("shifts Posture toward integrated", () => {
    const { trace } = applyDeltas({ judah: 0 }, [matured], 0);
    expect(accumulatePosture(trace, ["judah"]).judah.reading).toBe("integrated");
  });

  it("leaves an active or neutral fall-line on its own Marker", () => {
    const { trace } = applyDeltas(
      { judah: 0, levi: 0 },
      [
        d("judah-fall-power", "judah", "fallLine", 3, "active-shadow"),
        d("levi-fall-x", "levi", "fallLine", 2, "neutral"),
      ],
      0,
    );
    expect(trace.map((t) => [t.markerId, t.type, t.routedFrom])).toEqual([
      ["judah-fall-power", "fallLine", undefined],
      ["levi-fall-x", "fallLine", undefined],
    ]);
  });

  it("does not route an integrated shadow Marker — only fall-lines are routed", () => {
    const { trace } = applyDeltas({ judah: 0 }, [d("judah-shadow-x", "judah", "shadow", 2, "integrated")], 0);
    expect(trace[0].markerId).toBe("judah-shadow-x");
    expect(trace[0].routedFrom).toBeUndefined();
  });

  it("uses the injected oil lookup, and keeps the fall-line when a tribe has no oil Marker", () => {
    const { trace, profile } = applyDeltas({ judah: 0 }, [matured], 0, () => undefined);
    expect(trace[0].markerId).toBe("judah-fall-power");
    expect(profile.judah).toBe(3);
  });
});

describe("accumulatePosture", () => {
  const t = (
    tribeSlug: string,
    delta: number,
    postureSignal: ScoreTraceEntry["postureSignal"],
    type: ScoreTraceEntry["type"] = "shadow",
  ): ScoreTraceEntry => ({ turnIndex: 0, markerId: `${tribeSlug}-m`, tribeSlug, type, delta, postureSignal });

  it("covers every requested tribe, unread when it has no posture-bearing evidence", () => {
    const posture = accumulatePosture([t("judah", 2, "neutral")], ["judah", "levi"]);
    expect(posture.judah).toEqual({ integrated: 0, activeShadow: 0, arc: null, reading: "unread" });
    expect(posture.levi).toEqual({ integrated: 0, activeShadow: 0, arc: null, reading: "unread" });
  });

  it("tallies integrated and active-shadow evidence per tribe, weighted by delta", () => {
    const posture = accumulatePosture(
      [t("judah", 3, "integrated"), t("judah", 1, "active-shadow"), t("levi", 2, "active-shadow")],
      ["judah", "levi"],
    );
    expect(posture.judah).toMatchObject({ integrated: 3, activeShadow: 1, arc: 0.5, reading: "integrated" });
    expect(posture.levi).toMatchObject({ integrated: 0, activeShadow: 2, arc: -1, reading: "active-shadow" });
  });

  it("reads balanced evidence as mixed", () => {
    const posture = accumulatePosture([t("dan", 2, "integrated"), t("dan", 2, "active-shadow")], ["dan"]);
    expect(posture.dan).toMatchObject({ arc: 0, reading: "mixed" });
  });

  it("is independent of strength — a strong tribe can still be unread", () => {
    const posture = accumulatePosture([t("judah", 3, "neutral", "strength")], ["judah"]);
    expect(posture.judah.reading).toBe("unread");
  });

  it("ignores trace entries for tribes outside the requested set", () => {
    const posture = accumulatePosture([t("unknown", 3, "integrated")], ["judah"]);
    expect(Object.keys(posture)).toEqual(["judah"]);
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
