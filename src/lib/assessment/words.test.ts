import { describe, expect, it } from "vitest";
import {
  MAX_WORDS,
  MIN_WORDS,
  WORD_MAPPINGS,
  WORDS,
  validateWordMappings,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("exposes the participant list as the words of the mapping, in order", () => {
    expect(WORDS).toEqual(WORD_MAPPINGS.map((m) => m.word));
  });

  it("contains every transcribed adjective with no duplicates", () => {
    // The design doc's table has 74 rows (its "73" summary line is off by one).
    expect(WORDS).toHaveLength(74);
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it("maps every word to between one and three tribes", () => {
    for (const { word, tribes } of WORD_MAPPINGS) {
      expect(tribes.length, word).toBeGreaterThanOrEqual(1);
      expect(tribes.length, word).toBeLessThanOrEqual(3);
    }
  });

  it("uses the documented 8–15 selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("accepts the real word data", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("throws when a word references an unknown tribe slug", () => {
    const bad: WordMapping[] = [{ word: "Bogus", tribes: ["mordor"] }];
    expect(() => validateWordMappings(bad)).toThrow(/mordor/);
  });

  it("throws on a duplicate word", () => {
    const dup: WordMapping[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordMappings(dup)).toThrow(/Duplicate/);
  });

  it("throws when a word maps to no tribe", () => {
    const empty: WordMapping[] = [{ word: "Floating", tribes: [] }];
    expect(() => validateWordMappings(empty)).toThrow(/no tribe/);
  });
});
