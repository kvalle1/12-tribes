import { describe, it, expect } from "vitest";
import { MAX_WORDS, MIN_WORDS, WORDS } from "./words";
import {
  isWithinSelectionRange,
  shuffle,
  shuffledWordList,
} from "./selection";

describe("isWithinSelectionRange", () => {
  it("rejects fewer than the minimum", () => {
    expect(isWithinSelectionRange(MIN_WORDS - 1)).toBe(false);
    expect(isWithinSelectionRange(0)).toBe(false);
  });

  it("accepts the inclusive bounds and everything between", () => {
    expect(isWithinSelectionRange(MIN_WORDS)).toBe(true);
    expect(isWithinSelectionRange(MAX_WORDS)).toBe(true);
    for (let n = MIN_WORDS; n <= MAX_WORDS; n++) {
      expect(isWithinSelectionRange(n)).toBe(true);
    }
  });

  it("rejects more than the maximum", () => {
    expect(isWithinSelectionRange(MAX_WORDS + 1)).toBe(false);
  });
});

describe("shuffle", () => {
  it("returns a permutation containing exactly the same items", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, mulberry32(42));
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate its input", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input, mulberry32(7));
    expect(input).toEqual(copy);
  });

  it("is deterministic under a seeded RNG", () => {
    const input = ["a", "b", "c", "d"];
    expect(shuffle(input, mulberry32(99))).toEqual(shuffle(input, mulberry32(99)));
  });
});

describe("shuffledWordList", () => {
  it("contains every word from the list, with no additions or duplicates", () => {
    const list = shuffledWordList(mulberry32(1));
    const expected = WORDS.map((w) => w.word).sort();
    expect([...list].sort()).toEqual(expected);
    expect(new Set(list).size).toBe(WORDS.length);
  });

  it("returns only the word strings, never the tribe mapping", () => {
    const list = shuffledWordList(mulberry32(2));
    for (const entry of list) {
      expect(typeof entry).toBe("string");
    }
  });
});

/** Small seedable PRNG so shuffle tests are deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
