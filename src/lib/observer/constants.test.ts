import { describe, it, expect } from "vitest";
import { MIN_OBSERVERS, hasEnoughObservers } from "./constants";

describe("hasEnoughObservers", () => {
  it("is locked below the minimum", () => {
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks exactly at the minimum", () => {
    expect(hasEnoughObservers(MIN_OBSERVERS)).toBe(true);
  });

  it("stays unlocked above the minimum", () => {
    expect(hasEnoughObservers(MIN_OBSERVERS + 5)).toBe(true);
  });

  it("unlocks at three observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
