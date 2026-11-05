import { describe, expect, it } from "vitest";
import { arcFraming } from "./framing";

describe("arcFraming", () => {
  it("returns null for an active tribe — nothing to frame", () => {
    expect(arcFraming("active", "active-shadow")).toBeNull();
    expect(arcFraming("active", "integrated")).toBeNull();
  });

  it("frames a disqualified tribe without condemnation (restoration, not verdict)", () => {
    const text = arcFraming("disqualified", "unknown")!;
    expect(text).toMatch(/not a permanent verdict/i);
    expect(text).toMatch(/restoration/i);
  });

  it("adds a redemption reading at the integrated end of the arc", () => {
    const text = arcFraming("disqualified", "integrated")!;
    expect(text).toMatch(/integrated/i);
    expect(text).toMatch(/redemption/i);
  });

  it("adds a cautionary reading at the active-shadow end of the arc", () => {
    const text = arcFraming("disqualified-arc", "active-shadow")!;
    expect(text).toMatch(/active-shadow/i);
    expect(text).toMatch(/not a judgment/i);
  });

  it("omits an arc sentence when the arc reading is unknown or mixed", () => {
    const base = arcFraming("warning", "unknown")!;
    expect(arcFraming("warning", "mixed")).toBe(base);
    expect(base).not.toMatch(/integrated|active-shadow/i);
  });

  it("covers every non-active status", () => {
    for (const status of ["disqualified", "disqualified-arc", "warning"] as const) {
      expect(arcFraming(status, "unknown")).toBeTruthy();
    }
  });
});
