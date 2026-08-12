import { describe, it, expect } from "vitest";
import { MIN_OBSERVERS, isReportUnlocked } from "./constants";

describe("isReportUnlocked", () => {
  it("stays locked below the minimum observer count", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks exactly at the minimum and above", () => {
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});
