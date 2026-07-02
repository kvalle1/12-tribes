import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import type { Marker } from "./markers";
import {
  applyDeltas,
  deriveResult,
  emptyProfile,
  toDisplayShares,
} from "./scoring";
import type { ScoredDelta } from "./types";

/**
 * A tiny hand-built catalog so the tests assert external behavior against known
 * weights rather than the authored catalog (which can grow). `resolve` is
 * injected into `applyDeltas`, mirroring the Marker validator's testable seam.
 */
const TEST_MARKERS: Marker[] = [
  { id: "judah-str", tribeSlug: "judah", type: "strength", signal: "s", weight: 1 },
  { id: "judah-shadow", tribeSlug: "judah", type: "shadow", signal: "s", weight: 2 },
  { id: "judah-fall", tribeSlug: "judah", type: "fallLine", signal: "s", weight: 3 },
  { id: "levi-str", tribeSlug: "levi", type: "strength", signal: "s", weight: 1 },
];
const byId = new Map(TEST_MARKERS.map((m) => [m.id, m]));
const resolve = (id: string) => byId.get(id);

const delta = (over: Partial<ScoredDelta> & { markerId: string }): ScoredDelta => ({
  tribeSlug: byId.get(over.markerId)?.tribeSlug ?? "judah",
  type: byId.get(over.markerId)?.type ?? "strength",
  delta: 1,
  postureSignal: 0,
  ...over,
});

describe("emptyProfile", () => {
  it("covers all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) expect(profile[tribe.slug]).toBe(0);
  });
});

describe("applyDeltas", () => {
  it("adds weight × delta to the cited tribe's strength", () => {
    const { profile } = applyDeltas(
      emptyProfile(),
      [delta({ markerId: "judah-str", delta: 0.5 })],
      resolve,
    );
    expect(profile.judah).toBe(0.5); // weight 1 × 0.5
  });

  it("is additive: shadow and fall-line raise strength, never lower it", () => {
    const start = { ...emptyProfile(), judah: 2 };
    const { profile } = applyDeltas(
      start,
      [
        delta({ markerId: "judah-shadow", delta: 1 }), // +2
        delta({ markerId: "judah-fall", delta: 1 }), // +3
      ],
      resolve,
    );
    expect(profile.judah).toBe(7); // 2 + 2 + 3 — strictly increased
    expect(profile.judah).toBeGreaterThan(start.judah);
  });

  it("does not mutate the input profile", () => {
    const before = emptyProfile();
    applyDeltas(before, [delta({ markerId: "judah-str" })], resolve);
    expect(before.judah).toBe(0);
  });

  it("clamps the agent's delta into [0, 1] — a negative can never subtract", () => {
    const { profile } = applyDeltas(
      { ...emptyProfile(), judah: 1 },
      [delta({ markerId: "judah-str", delta: -5 })],
      resolve,
    );
    expect(profile.judah).toBe(1); // clamped to 0, so no change
  });

  it("drops deltas whose markerId is not in the catalog", () => {
    const { profile, applied } = applyDeltas(
      emptyProfile(),
      [delta({ markerId: "does-not-exist" })],
      resolve,
    );
    expect(applied).toHaveLength(0);
    expect(profile.judah).toBe(0);
  });

  it("drops deltas that mis-cite the Marker's tribe or type", () => {
    const { applied } = applyDeltas(
      emptyProfile(),
      [
        { markerId: "judah-str", tribeSlug: "levi", type: "strength", delta: 1, postureSignal: 0 },
        { markerId: "judah-str", tribeSlug: "judah", type: "shadow", delta: 1, postureSignal: 0 },
      ],
      resolve,
    );
    expect(applied).toHaveLength(0); // both mis-cited
  });

  it("returns a trace linking each applied delta to its Marker id and contribution", () => {
    const { applied } = applyDeltas(
      emptyProfile(),
      [delta({ markerId: "judah-fall", delta: 0.5, postureSignal: 0.8 })],
      resolve,
    );
    expect(applied).toEqual([
      {
        markerId: "judah-fall",
        tribeSlug: "judah",
        type: "fallLine",
        weight: 3,
        delta: 0.5,
        contribution: 1.5,
        postureSignal: 0.8,
      },
    ]);
  });
});

describe("toDisplayShares", () => {
  it("normalizes to percentages that sum to ~100 while scores stay independent", () => {
    const profile = { ...emptyProfile(), judah: 3, levi: 1 };
    const shares = toDisplayShares(profile);
    const sum = shares.reduce((s, x) => s + x.percent, 0);
    expect(sum).toBeCloseTo(100, 6);
    const judah = shares.find((s) => s.slug === "judah")!;
    expect(judah.percent).toBeCloseTo(75, 6);
    expect(judah.score).toBe(3); // raw score carried through unchanged
  });

  it("ranks tribes by score descending", () => {
    const shares = toDisplayShares({ ...emptyProfile(), levi: 5, judah: 2 });
    expect(shares[0].slug).toBe("levi");
    expect(shares[1].slug).toBe("judah");
  });

  it("returns all-zero shares for an unscored profile (no divide-by-zero)", () => {
    const shares = toDisplayShares(emptyProfile());
    expect(shares).toHaveLength(tribes.length);
    for (const s of shares) expect(s.percent).toBe(0);
  });
});

describe("deriveResult", () => {
  it("names the top-scoring tribe as primary", () => {
    const result = deriveResult({ ...emptyProfile(), judah: 4, levi: 1 });
    expect(result.primarySlug).toBe("judah");
    expect(result.shares[0].slug).toBe("judah");
  });

  it("has no primary when nothing scored", () => {
    expect(deriveResult(emptyProfile()).primarySlug).toBeNull();
  });
});
