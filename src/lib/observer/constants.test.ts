import { describe, it, expect } from "vitest";
import { MIN_OBSERVERS_FOR_REPORT, isReportUnlocked } from "./constants";

describe("isReportUnlocked", () => {
  it("stays locked below the threshold", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
  });

  it("unlocks at exactly the threshold", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
  });

  it("stays unlocked above the threshold", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT + 5)).toBe(true);
  });

  it("requires at least three observers, matching the spec", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
