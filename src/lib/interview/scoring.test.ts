import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { markerCatalog } from "./markers";
import type { MarkerDelta, PostureProfile, StrengthProfile } from "./types";
import {
  MAX_DELTA_MULTIPLIER,
  ScoringError,
  applyScoredTurn,
  emptyPosture,
  emptyStrengthProfile,
  normalizeProfile,
  validateAndApplyDeltas,
} from "./scoring";

const judahStrength = markerCatalog.find((m) => m.id === "judah-strength-front")!;
const judahFallLine = markerCatalog.find((m) => m.id === "judah-fall-power")!;
const judahOil = markerCatalog.find((m) => m.id === "judah-oil-responsibility")!;
const leviShadow = markerCatalog.find((m) => m.id === "levi-shadow-legalism")!;

function zero(): { profile: StrengthProfile; posture: PostureProfile } {
  return { profile: emptyStrengthProfile(), posture: emptyPosture() };
}

describe("emptyStrengthProfile / emptyPosture", () => {
  it("covers all 12 tribes zeroed", () => {
    const profile = emptyStrengthProfile();
    const posture = emptyPosture();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) {
      expect(profile[tribe.slug]).toBe(0);
      expect(posture[tribe.slug]).toBe(0);
    }
  });
});

describe("validateAndApplyDeltas (additive rule, never lowers strength — ADR 0004)", () => {
  it("adds a strength Marker delta to the cited tribe", () => {
    const base = zero();
    const deltas: MarkerDelta[] = [
      {
        markerId: judahStrength.id,
        tribeSlug: judahStrength.tribeSlug,
        type: judahStrength.type,
        delta: judahStrength.weight,
      },
    ];
    const next = validateAndApplyDeltas(base.profile, base.posture, deltas);
    expect(next.profile.judah).toBe(judahStrength.weight);
    // Every other tribe stays zero.
    for (const tribe of tribes) {
      if (tribe.slug !== "judah") expect(next.profile[tribe.slug]).toBe(0);
    }
  });

  it("treats a fall-line Marker as additive on strength — never subtracts", () => {
    const base = zero();
    const deltas: MarkerDelta[] = [
      {
        markerId: judahFallLine.id,
        tribeSlug: judahFallLine.tribeSlug,
        type: "fallLine",
        delta: judahFallLine.weight,
      },
    ];
    const next = validateAndApplyDeltas(base.profile, base.posture, deltas);
    // Additive — a fall-line reading is *evidence of* the tribe, not against it.
    expect(next.profile.judah).toBeGreaterThan(0);
    expect(next.profile.judah).toBe(judahFallLine.weight);
  });

  it("treats a shadow Marker as additive on strength — never subtracts", () => {
    const base = zero();
    const deltas: MarkerDelta[] = [
      {
        markerId: leviShadow.id,
        tribeSlug: leviShadow.tribeSlug,
        type: "shadow",
        delta: leviShadow.weight,
      },
    ];
    const next = validateAndApplyDeltas(base.profile, base.posture, deltas);
    expect(next.profile.levi).toBe(leviShadow.weight);
  });

  it("rejects a negative delta rather than lowering strength", () => {
    const base = zero();
    const deltas: MarkerDelta[] = [
      {
        markerId: judahStrength.id,
        tribeSlug: judahStrength.tribeSlug,
        type: "strength",
        delta: -1,
      },
    ];
    expect(() =>
      validateAndApplyDeltas(base.profile, base.posture, deltas),
    ).toThrow(ScoringError);
  });

  it("rejects a delta citing a Marker that isn't in the catalog", () => {
    const base = zero();
    const deltas: MarkerDelta[] = [
      {
        markerId: "not-a-real-marker",
        tribeSlug: "judah",
        type: "strength",
        delta: 1,
      },
    ];
    expect(() =>
      validateAndApplyDeltas(base.profile, base.posture, deltas),
    ).toThrow(ScoringError);
  });

  it("rejects a delta whose tribeSlug/type contradicts the cited Marker", () => {
    const base = zero();
    // The Marker exists but the delta claims it's a shadow signal for reuben.
    const deltas: MarkerDelta[] = [
      {
        markerId: judahStrength.id,
        tribeSlug: "reuben",
        type: "shadow",
        delta: 1,
      },
    ];
    expect(() =>
      validateAndApplyDeltas(base.profile, base.posture, deltas),
    ).toThrow(ScoringError);
  });

  it("caps an over-weight delta at MAX_DELTA_MULTIPLIER × Marker.weight", () => {
    const base = zero();
    const cap = judahStrength.weight * MAX_DELTA_MULTIPLIER;
    const deltas: MarkerDelta[] = [
      {
        markerId: judahStrength.id,
        tribeSlug: judahStrength.tribeSlug,
        type: "strength",
        delta: cap + 5,
      },
    ];
    const next = validateAndApplyDeltas(base.profile, base.posture, deltas);
    expect(next.profile.judah).toBe(cap);
  });

  it("shifts Posture toward integrated on postureSignal:+1 without lowering strength", () => {
    const base = zero();
    const deltas: MarkerDelta[] = [
      {
        markerId: judahOil.id,
        tribeSlug: judahOil.tribeSlug,
        type: "oil",
        delta: judahOil.weight,
        postureSignal: 1,
      },
    ];
    const next = validateAndApplyDeltas(base.profile, base.posture, deltas);
    expect(next.profile.judah).toBe(judahOil.weight);
    expect(next.posture.judah).toBeGreaterThan(0);
  });

  it("shifts Posture toward active-shadow on postureSignal:-1 without lowering strength", () => {
    const base = zero();
    const deltas: MarkerDelta[] = [
      {
        markerId: leviShadow.id,
        tribeSlug: leviShadow.tribeSlug,
        type: "shadow",
        delta: leviShadow.weight,
        postureSignal: -1,
      },
    ];
    const next = validateAndApplyDeltas(base.profile, base.posture, deltas);
    expect(next.profile.levi).toBe(leviShadow.weight);
    expect(next.posture.levi).toBeLessThan(0);
  });

  it("does not mutate the input profile or posture", () => {
    const base = zero();
    validateAndApplyDeltas(base.profile, base.posture, [
      {
        markerId: judahStrength.id,
        tribeSlug: "judah",
        type: "strength",
        delta: 1,
      },
    ]);
    for (const tribe of tribes) {
      expect(base.profile[tribe.slug]).toBe(0);
      expect(base.posture[tribe.slug]).toBe(0);
    }
  });
});

describe("normalizeProfile (cosmetic display share, ADR 0002)", () => {
  it("returns share=0 for every tribe when the profile is all zeros", () => {
    const norm = normalizeProfile(emptyStrengthProfile());
    expect(norm.entries).toHaveLength(tribes.length);
    for (const entry of norm.entries) expect(entry.share).toBe(0);
  });

  it("makes shares sum to ~1 when at least one tribe has evidence", () => {
    const profile = emptyStrengthProfile();
    profile.judah = 3;
    profile.levi = 1;
    const norm = normalizeProfile(profile);
    const sum = norm.entries.reduce((s, e) => s + e.share, 0);
    expect(sum).toBeCloseTo(1, 6);
    const judah = norm.entries.find((e) => e.slug === "judah")!;
    const levi = norm.entries.find((e) => e.slug === "levi")!;
    expect(judah.share).toBeCloseTo(0.75, 6);
    expect(levi.share).toBeCloseTo(0.25, 6);
  });

  it("preserves the raw score alongside each share", () => {
    const profile = emptyStrengthProfile();
    profile.judah = 7;
    const norm = normalizeProfile(profile);
    const judah = norm.entries.find((e) => e.slug === "judah")!;
    expect(judah.score).toBe(7);
  });
});

describe("applyScoredTurn (trace + append + fold)", () => {
  it("appends the Turn with its deltas so the trace is preserved", () => {
    const state = {
      status: "in_progress" as const,
      turns: [],
      profile: emptyStrengthProfile(),
      posture: emptyPosture(),
      currentQuestion: "Q1",
    };
    const deltas: MarkerDelta[] = [
      {
        markerId: judahStrength.id,
        tribeSlug: "judah",
        type: "strength",
        delta: 1,
      },
    ];
    const next = applyScoredTurn(state, "an answer", deltas);
    expect(next.turns).toHaveLength(1);
    expect(next.turns[0].question).toBe("Q1");
    expect(next.turns[0].answer).toBe("an answer");
    expect(next.turns[0].scored).toEqual(deltas);
    expect(next.profile.judah).toBe(1);
  });

  it("refuses to apply if there is no current question", () => {
    const state = {
      status: "in_progress" as const,
      turns: [],
      profile: emptyStrengthProfile(),
      posture: emptyPosture(),
      currentQuestion: null,
    };
    expect(() => applyScoredTurn(state, "answer", [])).toThrow();
  });
});
