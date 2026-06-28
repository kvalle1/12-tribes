import { describe, it, expect } from "vitest";
import { shuffle } from "./shuffle";

/** A tiny deterministic RNG (mulberry32) so shuffles are reproducible in tests. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("shuffle", () => {
  it("returns a permutation containing exactly the same elements", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, seeded(1));
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    const copy = [...input];
    shuffle(input, seeded(42));
    expect(input).toEqual(copy);
  });

  it("is deterministic for a given RNG seed", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(input, seeded(7))).toEqual(shuffle(input, seeded(7)));
  });

  it("produces different orders for different seeds (so each session differs)", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(input, seeded(1))).not.toEqual(shuffle(input, seeded(2)));
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle([], seeded(1))).toEqual([]);
    expect(shuffle([99], seeded(1))).toEqual([99]);
  });
});
