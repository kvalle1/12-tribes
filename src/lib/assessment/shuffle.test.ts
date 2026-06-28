import { describe, expect, it } from "vitest";
import { shuffleWithSeed } from "./shuffle";

const SAMPLE = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;

describe("shuffleWithSeed", () => {
  it("is deterministic — the same seed yields the same order", () => {
    expect(shuffleWithSeed(SAMPLE, 12345)).toEqual(shuffleWithSeed(SAMPLE, 12345));
  });

  it("returns a permutation — same elements, same length", () => {
    const shuffled = shuffleWithSeed(SAMPLE, 999);
    expect(shuffled).toHaveLength(SAMPLE.length);
    expect([...shuffled].sort()).toEqual([...SAMPLE].sort());
  });

  it("does not mutate the input array", () => {
    const input = [...SAMPLE];
    shuffleWithSeed(input, 42);
    expect(input).toEqual([...SAMPLE]);
  });

  it("generally produces different orders for different seeds", () => {
    expect(shuffleWithSeed(SAMPLE, 1)).not.toEqual(shuffleWithSeed(SAMPLE, 2));
  });

  it("handles trivially short inputs", () => {
    expect(shuffleWithSeed([], 5)).toEqual([]);
    expect(shuffleWithSeed(["only"], 5)).toEqual(["only"]);
  });
});
