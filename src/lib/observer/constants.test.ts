import { describe, it, expect } from "vitest";
import { OBSERVER_UNLOCK_THRESHOLD, isReportUnlocked } from "./constants";

describe("isReportUnlocked", () => {
  it("stays locked below the threshold of 3 observers", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(1)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
  });

  it("unlocks at exactly 3 observers and beyond", () => {
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(4)).toBe(true);
    expect(isReportUnlocked(50)).toBe(true);
  });
});
