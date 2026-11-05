import { describe, expect, it } from "vitest";
import { arcFraming, postureLabel } from "./framing";

describe("arcFraming", () => {
  it("returns null for an active tribe (no special framing)", () => {
    expect(arcFraming("active", "integrated")).toBeNull();
    expect(arcFraming("active", "active-shadow")).toBeNull();
  });

  it("frames an integrated, disqualified Primary as a redemption arc", () => {
    const framing = arcFraming("disqualified", "integrated");
    expect(framing?.arcLabel).toBe("Redemption arc");
    expect(framing?.note).toMatch(/redemption arc/i);
  });

  it("frames an active-shadow, disqualified Primary as a cautionary arc", () => {
    const framing = arcFraming("disqualified", "active-shadow");
    expect(framing?.arcLabel).toBe("Cautionary arc");
    expect(framing?.note).toMatch(/cautionary/i);
  });

  it("always produces affirming framing for every non-active status and posture", () => {
    const statuses = ["disqualified", "warning", "disqualified-arc"] as const;
    const postures = ["integrated", "active-shadow", "mixed", "unknown"] as const;
    for (const status of statuses) {
      for (const posture of postures) {
        const framing = arcFraming(status, posture);
        expect(framing).not.toBeNull();
        expect(framing!.note.length).toBeGreaterThan(0);
        // The caution is framed as an invitation / real wiring, never a verdict.
        expect(framing!.note).toMatch(/invitation|real|evidence the wiring is yours/i);
      }
    }
  });

  it("names each non-active status's caution in the note", () => {
    expect(arcFraming("disqualified", "mixed")!.note).toMatch(/Revelation 7/);
    expect(arcFraming("warning", "mixed")!.note).toMatch(/warning/i);
    expect(arcFraming("disqualified-arc", "mixed")!.note).toMatch(/captivity/i);
  });
});

describe("postureLabel", () => {
  it("gives a human label for each posture reading", () => {
    expect(postureLabel("integrated")).toBe("Integrated");
    expect(postureLabel("active-shadow")).toBe("Active shadow");
    expect(postureLabel("mixed")).toBe("In motion");
    expect(postureLabel("unknown")).toBe("Unread");
  });
});
