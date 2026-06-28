import { describe, expect, it } from "vitest";
import {
  applyDeltas,
  clampContribution,
  derivePrimarySlug,
  normalizeProfile,
  type MarkerInfo,
  type MarkerLookup,
} from "./scoring";
import type { ScoreDelta, StrengthProfile } from "./types";

/**
 * A fake catalog for the engine under test. The real catalog is server-only and
 * irrelevant here — the engine's contract is "given these Marker facts, fold
 * these deltas" — so we inject a tiny lookup and assert the external behavior.
 */
const FAKE_MARKERS: Record<string, MarkerInfo> = {
  "judah-strength": { tribeSlug: "judah", type: "strength", weight: 1 },
  "judah-shadow": { tribeSlug: "judah", type: "shadow", weight: 2 },
  "judah-fall": { tribeSlug: "judah", type: "fallLine", weight: 3 },
  "levi-strength": { tribeSlug: "levi", type: "strength", weight: 1 },
  "levi-oil": { tribeSlug: "levi", type: "oil", weight: 2 },
};
const lookup: MarkerLookup = (id) => FAKE_MARKERS[id];

function delta(markerId: string, d: number): ScoreDelta {
  const info = FAKE_MARKERS[markerId];
  return {
    markerId,
    tribeSlug: info?.tribeSlug ?? "unknown",
    type: info?.type ?? "strength",
    delta: d,
    postureSignal: "neutral",
  };
}

const emptyProfile: StrengthProfile = { judah: 0, levi: 0 };

describe("clampContribution", () => {
  it("bounds a contribution to the Marker weight", () => {
    expect(clampContribution(5, 3)).toBe(3);
    expect(clampContribution(2, 3)).toBe(2);
  });

  it("never contributes a negative or non-finite amount (malformed deltas score nothing)", () => {
    expect(clampContribution(-4, 3)).toBe(0);
    expect(clampContribution(Number.NaN, 3)).toBe(0);
    expect(clampContribution(Infinity, 3)).toBe(0);
  });
});

describe("applyDeltas", () => {
  it("adds a strength contribution to the cited tribe", () => {
    const { profile } = applyDeltas(emptyProfile, [delta("judah-strength", 1)], {
      turnIndex: 0,
      lookup,
    });
    expect(profile.judah).toBe(1);
    expect(profile.levi).toBe(0);
  });

  it("does not mutate the input profile", () => {
    const before: StrengthProfile = { judah: 0, levi: 0 };
    applyDeltas(before, [delta("judah-strength", 1)], { turnIndex: 0, lookup });
    expect(before.judah).toBe(0);
  });

  it("treats shadow and fall-line deltas as additive — they never lower strength (ADR-0004)", () => {
    // Seed the tribe with some strength, then apply shadow and fall-line.
    const seeded: StrengthProfile = { judah: 5, levi: 0 };
    const { profile } = applyDeltas(
      seeded,
      [delta("judah-shadow", 2), delta("judah-fall", 3)],
      { turnIndex: 0, lookup },
    );
    // Both raised it; neither subtracted.
    expect(profile.judah).toBe(10);
    expect(profile.judah).toBeGreaterThan(seeded.judah);
  });

  it("clamps each contribution to the Marker weight (agent cannot inflate)", () => {
    const { profile } = applyDeltas(emptyProfile, [delta("judah-strength", 99)], {
      turnIndex: 0,
      lookup,
    });
    expect(profile.judah).toBe(1); // weight cap, not 99
  });

  it("uses the catalog's tribe/type, not the payload's claim", () => {
    // Payload lies: cites the levi-oil Marker but claims it's judah/strength.
    const lying: ScoreDelta = {
      markerId: "levi-oil",
      tribeSlug: "judah",
      type: "strength",
      delta: 2,
      postureSignal: "integrated",
    };
    const { profile, entries } = applyDeltas(emptyProfile, [lying], {
      turnIndex: 1,
      lookup,
    });
    expect(profile.levi).toBe(2); // landed on levi (authoritative), not judah
    expect(profile.judah).toBe(0);
    expect(entries[0].tribeSlug).toBe("levi");
    expect(entries[0].type).toBe("oil");
  });

  it("drops deltas that cite an unknown Marker id", () => {
    const { profile, entries } = applyDeltas(
      emptyProfile,
      [delta("judah-strength", 1), { ...delta("judah-strength", 1), markerId: "nope" }],
      { turnIndex: 0, lookup },
    );
    expect(profile.judah).toBe(1); // only the real one counted
    expect(entries).toHaveLength(1);
  });

  it("records a trace entry back to the answer's Turn and the Marker id", () => {
    const { entries } = applyDeltas(emptyProfile, [delta("judah-fall", 3)], {
      turnIndex: 2,
      lookup,
    });
    expect(entries).toEqual([
      {
        turnIndex: 2,
        markerId: "judah-fall",
        tribeSlug: "judah",
        type: "fallLine",
        postureSignal: "neutral",
        applied: 3,
      },
    ]);
  });

  it("omits a trace entry for a zero-contribution delta", () => {
    const { entries } = applyDeltas(emptyProfile, [delta("judah-strength", -1)], {
      turnIndex: 0,
      lookup,
    });
    expect(entries).toHaveLength(0);
  });
});

describe("normalizeProfile", () => {
  it("turns independent strengths into percentages summing to ~100", () => {
    const normalized = normalizeProfile({ judah: 3, levi: 1 });
    expect(normalized.judah).toBe(75);
    expect(normalized.levi).toBe(25);
  });

  it("returns all zeros for an all-zero profile without dividing by zero", () => {
    expect(normalizeProfile({ judah: 0, levi: 0 })).toEqual({ judah: 0, levi: 0 });
  });

  it("does not mutate the input", () => {
    const before = { judah: 3, levi: 1 };
    normalizeProfile(before);
    expect(before).toEqual({ judah: 3, levi: 1 });
  });
});

describe("derivePrimarySlug", () => {
  it("picks the highest-strength tribe", () => {
    expect(derivePrimarySlug({ judah: 2, levi: 5 })).toBe("levi");
  });

  it("breaks ties by key order (canonical tribe order)", () => {
    expect(derivePrimarySlug({ judah: 4, levi: 4 })).toBe("judah");
  });

  it("returns null for an empty profile", () => {
    expect(derivePrimarySlug({})).toBeNull();
  });
});
