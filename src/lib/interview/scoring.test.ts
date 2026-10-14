import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import type { Marker } from "./markers";
import {
  applyDeltas,
  emptyProfile,
  normalizeProfile,
  validateScoredDeltas,
} from "./scoring";
import type { ScoredDelta } from "./types";

/**
 * A tiny fixture catalog so weights and reconciliation are deterministic and
 * independent of the authored catalog. One Marker of each relevant type.
 */
const FIXTURE: Marker[] = [
  { id: "judah-s", tribeSlug: "judah", type: "strength", signal: "s", weight: 1 },
  { id: "levi-sh", tribeSlug: "levi", type: "shadow", signal: "sh", weight: 2 },
  { id: "dan-fl", tribeSlug: "dan", type: "fallLine", signal: "fl", weight: 3 },
];

describe("validateScoredDeltas (Marker-constrained — ADR-0003)", () => {
  it("drops deltas citing a Marker that is not in the catalog", () => {
    const out = validateScoredDeltas(
      [{ markerId: "not-a-real-marker", delta: 1, postureSignal: "neutral" }],
      FIXTURE,
    );
    expect(out).toEqual([]);
  });

  it("drops deltas with a missing or non-string markerId", () => {
    const out = validateScoredDeltas(
      [{ delta: 1 }, { markerId: 123, delta: 1 }],
      FIXTURE,
    );
    expect(out).toEqual([]);
  });

  it("reconciles tribeSlug and type to the catalog, not the model's echo", () => {
    const [d] = validateScoredDeltas(
      [
        {
          markerId: "judah-s",
          tribeSlug: "levi", // wrong on purpose
          type: "shadow", // wrong on purpose
          delta: 1,
          postureSignal: "neutral",
        },
      ],
      FIXTURE,
    );
    expect(d.tribeSlug).toBe("judah");
    expect(d.type).toBe("strength");
    expect(d.markerId).toBe("judah-s"); // the trace anchor is preserved
  });

  it("clamps delta to [0, marker.weight] and treats junk as 0", () => {
    const deltas = validateScoredDeltas(
      [
        { markerId: "judah-s", delta: 5, postureSignal: "neutral" }, // over weight 1
        { markerId: "levi-sh", delta: -2, postureSignal: "neutral" }, // negative
        { markerId: "dan-fl", delta: Number.NaN, postureSignal: "neutral" }, // junk
      ],
      FIXTURE,
    );
    expect(deltas.map((d) => d.delta)).toEqual([1, 0, 0]);
  });

  it("keeps a delta that is within the marker's weight", () => {
    const [d] = validateScoredDeltas(
      [{ markerId: "dan-fl", delta: 1.5, postureSignal: "neutral" }],
      FIXTURE,
    );
    expect(d.delta).toBe(1.5);
  });

  it("collapses repeat citations of one Marker to a single bounded entry (keeps the strongest)", () => {
    const out = validateScoredDeltas(
      [
        { markerId: "dan-fl", delta: 1, postureSignal: "neutral" },
        { markerId: "dan-fl", delta: 3, postureSignal: "active-shadow" },
        { markerId: "dan-fl", delta: 2, postureSignal: "neutral" },
      ],
      FIXTURE,
    );
    expect(out).toHaveLength(1);
    expect(out[0].delta).toBe(3); // not 1+3+2 = 6; a single Marker stays bounded
    expect(out[0].postureSignal).toBe("active-shadow");
  });

  it("coerces an unknown posture signal to neutral and preserves a valid one", () => {
    const [bogus, good] = validateScoredDeltas(
      [
        { markerId: "judah-s", delta: 1, postureSignal: "sideways" },
        { markerId: "dan-fl", delta: 1, postureSignal: "integrated" },
      ],
      FIXTURE,
    );
    expect(bogus.postureSignal).toBe("neutral");
    expect(good.postureSignal).toBe("integrated");
  });
});

describe("applyDeltas (additive strength — ADR-0004)", () => {
  const delta = (over: Partial<ScoredDelta>): ScoredDelta => ({
    markerId: "m",
    tribeSlug: "judah",
    type: "strength",
    delta: 1,
    postureSignal: "neutral",
    ...over,
  });

  it("adds deltas to the matching tribe", () => {
    const next = applyDeltas(emptyProfile(), [
      delta({ tribeSlug: "judah", delta: 1 }),
      delta({ tribeSlug: "judah", delta: 2 }),
    ]);
    expect(next.judah).toBe(3);
  });

  it("raises strength for shadow and fall-line deltas — never lowers it", () => {
    const next = applyDeltas(emptyProfile(), [
      delta({ tribeSlug: "levi", type: "shadow", delta: 2 }),
      delta({ tribeSlug: "dan", type: "fallLine", delta: 3 }),
    ]);
    expect(next.levi).toBe(2);
    expect(next.dan).toBe(3);
    // Every tribe stays at or above its starting score of 0.
    for (const tribe of tribes) expect(next[tribe.slug]).toBeGreaterThanOrEqual(0);
  });

  it("does not mutate the input profile", () => {
    const before = emptyProfile();
    applyDeltas(before, [delta({ tribeSlug: "judah", delta: 5 })]);
    expect(before.judah).toBe(0);
  });

  it("ignores a delta for an unknown tribe slug", () => {
    const next = applyDeltas(emptyProfile(), [
      delta({ tribeSlug: "atlantis", delta: 9 }),
    ]);
    expect(next).toEqual(emptyProfile());
  });
});

describe("normalizeProfile (display shares — ADR-0002)", () => {
  it("returns all zeros when nothing has been scored (no flat prior)", () => {
    const shares = normalizeProfile(emptyProfile());
    expect(Object.values(shares).every((v) => v === 0)).toBe(true);
  });

  it("splits shares in proportion to independent scores, summing to 100", () => {
    const profile = { ...emptyProfile(), judah: 3, dan: 1 };
    const shares = normalizeProfile(profile);
    expect(shares.judah).toBeCloseTo(75);
    expect(shares.dan).toBeCloseTo(25);
    const sum = Object.values(shares).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100);
  });
});
