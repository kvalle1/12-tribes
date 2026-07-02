import { describe, it, expect } from "vitest";
import {
  MIN_OBSERVERS_FOR_REPORT,
  hasEnoughObservers,
} from "./constants";

describe("hasEnoughObservers", () => {
  it("unlocks the report exactly at the ≥3 threshold (ADR-0003)", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(hasEnoughObservers(2)).toBe(false); // just below the floor stays locked
    expect(hasEnoughObservers(3)).toBe(true); // the floor itself unlocks
    expect(hasEnoughObservers(4)).toBe(true); // above the floor stays unlocked
  });

  it("keeps the report locked with no responses", () => {
    expect(hasEnoughObservers(0)).toBe(false);
  });
});
