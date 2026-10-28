import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { MAX_TURNS, MIN_TURNS } from "./confidence";
import { interviewProgress } from "./progress";
import type { StrengthProfile } from "./types";

/** A zeroed 12-tribe profile with the given overrides. */
function profileOf(scores: Record<string, number>): StrengthProfile {
  const profile: StrengthProfile = {};
  for (const tribe of tribes) profile[tribe.slug] = 0;
  return { ...profile, ...scores };
}

describe("interviewProgress", () => {
  it("is in the calibrating phase before the minimum floor", () => {
    const p = interviewProgress(profileOf({ judah: 2 }), 2);
    expect(p.phase).toBe("calibrating");
    expect(p.answered).toBe(2);
  });

  it("never reports full progress before the floor, however decisive the lead", () => {
    const p = interviewProgress(profileOf({ judah: 100 }), MIN_TURNS - 1);
    expect(p.fraction).toBeLessThan(1);
  });

  it("grows with each answer before the floor", () => {
    const early = interviewProgress(profileOf({ judah: 1 }), 1).fraction;
    const later = interviewProgress(profileOf({ judah: 1 }), 3).fraction;
    expect(later).toBeGreaterThan(early);
  });

  it("moves to at least the midpoint once the floor is reached", () => {
    const p = interviewProgress(profileOf({ judah: 3, levi: 1 }), MIN_TURNS);
    expect(p.fraction).toBeGreaterThanOrEqual(0.5);
  });

  it("reads as closing when the result is confident and separable past the floor", () => {
    const p = interviewProgress(profileOf({ judah: 40, levi: 1 }), MIN_TURNS + 1);
    expect(p.phase).toBe("closing");
  });

  it("stays narrowing (not closing) for inseparable top tribes, even near the cap", () => {
    const p = interviewProgress(profileOf({ judah: 10, levi: 10 }), MAX_TURNS - 1);
    expect(p.phase).toBe("narrowing");
    expect(p.fraction).toBeGreaterThan(0.9);
  });

  it("never slides backwards when later evidence narrows the lead", () => {
    // A decisive lead (high confidence) followed by a tie (low confidence) one
    // answer later: the bar must not shrink, even though confidence dropped.
    const earlier = interviewProgress(profileOf({ judah: 40, levi: 1 }), MIN_TURNS + 1).fraction;
    const later = interviewProgress(profileOf({ judah: 10, levi: 10 }), MIN_TURNS + 2).fraction;
    expect(later).toBeGreaterThanOrEqual(earlier);
  });

  it("advances the bar by turn count, not confidence, past the floor", () => {
    const decisive = interviewProgress(profileOf({ judah: 40, levi: 1 }), MIN_TURNS + 2).fraction;
    const murky = interviewProgress(profileOf({ judah: 2, levi: 2 }), MIN_TURNS + 2).fraction;
    expect(decisive).toBe(murky);
  });

  it("stays within 0..1 at every turn and exposes no fixed-length total", () => {
    for (let t = 0; t <= MAX_TURNS; t++) {
      const p = interviewProgress(profileOf({ judah: 3, levi: 2 }), t);
      expect(p.fraction).toBeGreaterThanOrEqual(0);
      expect(p.fraction).toBeLessThanOrEqual(1);
    }
    const keys = Object.keys(interviewProgress(profileOf({ judah: 1 }), 1)).sort();
    expect(keys).toEqual(["answered", "fraction", "label", "phase"]);
  });
});
