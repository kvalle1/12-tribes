import { describe, expect, it } from "vitest";
import { getTribeBySlug, tribes } from "@/lib/tribes";
import { POSTURE_LABELS, REDEEMED_EXEMPLARS, statusFraming } from "./posture";
import type { PostureReading } from "./types";

const READINGS: PostureReading[] = ["active-shadow", "mixed", "integrated", "unread"];
const flagged = tribes.filter((t) => t.status !== "active");

describe("statusFraming", () => {
  it("has no framing for an active tribe", () => {
    expect(statusFraming(getTribeBySlug("judah")!, "integrated")).toBeNull();
  });

  it("frames every disqualified/warning tribe, for every Posture reading", () => {
    expect(flagged.map((t) => t.slug).sort()).toEqual(["dan", "gad", "reuben", "simeon"]);
    for (const tribe of flagged) {
      for (const reading of READINGS) {
        const framing = statusFraming(tribe, reading);
        expect(framing?.status.trim()).toBeTruthy();
        expect(framing?.arc.trim()).toBeTruthy();
        expect(framing?.exemplar).toBeDefined();
      }
    }
  });

  it("gives an integrated Primary the redemption reading", () => {
    const framing = statusFraming(getTribeBySlug("dan")!, "integrated");
    expect(framing?.tone).toBe("redemption");
    expect(framing?.exemplar?.name).toBe("Nehemiah");
  });

  it("gives an active-shadow Primary the cautionary reading", () => {
    expect(statusFraming(getTribeBySlug("simeon")!, "active-shadow")?.tone).toBe("cautionary");
  });

  it("is a reading, not a verdict — the copy never condemns the participant", () => {
    for (const tribe of flagged) {
      for (const reading of READINGS) {
        const { status, arc } = statusFraming(tribe, reading)!;
        expect(`${status} ${arc}`).not.toMatch(/you are (disqualified|rejected|condemned)/i);
      }
    }
  });
});

describe("REDEEMED_EXEMPLARS", () => {
  it("names a redeemed exemplar already in each flagged tribe's notable people", () => {
    for (const tribe of flagged) {
      const name = REDEEMED_EXEMPLARS[tribe.slug];
      expect(tribe.notablePeople.map((p) => p.name)).toContain(name);
    }
  });
});

describe("POSTURE_LABELS", () => {
  it("labels every reading", () => {
    for (const reading of READINGS) expect(POSTURE_LABELS[reading]).toBeTruthy();
  });
});
