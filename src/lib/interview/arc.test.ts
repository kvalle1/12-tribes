import { describe, expect, it } from "vitest";
import { arcFraming, postureLabel } from "./arc";

describe("postureLabel", () => {
  it("names each arc position", () => {
    expect(postureLabel("integrated")).toBe("Integrated");
    expect(postureLabel("active-shadow")).toBe("Active shadow");
    expect(postureLabel("neutral")).toBe("Mid-arc");
  });
});

describe("arcFraming", () => {
  it("returns no framing for an active tribe (nothing to caution)", () => {
    expect(arcFraming("active", "active-shadow")).toBeNull();
  });

  it("frames a disqualified Primary without condemnation", () => {
    const framing = arcFraming("disqualified", "active-shadow");
    expect(framing).not.toBeNull();
    const text = `${framing!.heading} ${framing!.note}`.toLowerCase();
    // Non-condemning: names the warning, not a verdict on the person.
    expect(text).toContain("warning");
    expect(text).not.toContain("condemn");
    expect(text).not.toMatch(/you are (disqualified|unworthy|bad)/);
  });

  it("gives an integrated posture the redemption reading", () => {
    const framing = arcFraming("disqualified", "integrated");
    expect(framing!.note.toLowerCase()).toContain("redempt");
  });

  it("gives an active-shadow posture the cautionary reading", () => {
    const framing = arcFraming("disqualified", "active-shadow");
    expect(framing!.note.toLowerCase()).toContain("caution");
  });

  it("frames the warning and disqualified-arc statuses too", () => {
    expect(arcFraming("warning", "neutral")).not.toBeNull();
    expect(arcFraming("disqualified-arc", "integrated")).not.toBeNull();
  });

  it("puts the posture position in the heading", () => {
    expect(arcFraming("disqualified", "integrated")!.heading).toContain("Integrated");
  });
});
