import { describe, it, expect } from "vitest";
import { MIN_OBSERVERS, hasEnoughObservers } from "./constants";

describe("hasEnoughObservers", () => {
  it("locks below the minimum", () => {
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks at and above the minimum", () => {
    expect(hasEnoughObservers(MIN_OBSERVERS)).toBe(true);
    expect(hasEnoughObservers(MIN_OBSERVERS + 5)).toBe(true);
  });

  it("unlocks at exactly three (ADR-0003)", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
