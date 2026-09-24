import { describe, it, expect } from "vitest";
import { MIN_OBSERVERS, hasEnoughObservers } from "./constants";

describe("hasEnoughObservers", () => {
  it("keeps the report locked below the minimum", () => {
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks exactly at the minimum and above", () => {
    expect(hasEnoughObservers(MIN_OBSERVERS)).toBe(true);
    expect(hasEnoughObservers(MIN_OBSERVERS + 2)).toBe(true);
  });

  it("requires at least three observers (ADR-0003 unlock threshold)", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
