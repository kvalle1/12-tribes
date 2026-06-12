import { describe, expect, it } from "vitest";
import { tribes } from "../tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  validateWordMappings,
  wordList,
  words,
} from "./words";

describe("word data", () => {
  it("contains every word from the ASSESSMENT_DESIGN.md mapping table", () => {
    // The mapping table (and the flat word list above it) both contain 74
    // rows. The doc's "Total: 73 words" annotation is an off-by-one miscount;
    // we transcribe the actual table, which is the substantive source of truth.
    expect(words).toHaveLength(74);
    expect(wordList).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    expect(new Set(wordList).size).toBe(wordList.length);
  });

  it("exposes the selection constants (8–15)", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("matches a few known mappings from ASSESSMENT_DESIGN.md", () => {
    const byWord = (w: string) => words.find((m) => m.word === w);
    expect(byWord("Courageous")?.tribes).toEqual(["judah"]);
    expect(byWord("Bold")?.tribes).toEqual(["judah", "reuben"]);
    // "Zealous" is the only three-tribe word.
    expect(byWord("Zealous")?.tribes).toEqual(["judah", "benjamin", "simeon"]);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word data (every slug resolves)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("cross-checks: every mapped slug exists in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const { tribes: slugs } of words) {
      for (const slug of slugs) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("throws loudly when a word maps to an unknown tribe slug", () => {
    expect(() =>
      validateWordMappings([{ word: "Bogus", tribes: ["not-a-tribe"] }]),
    ).toThrow(/not-a-tribe/);
  });

  it("throws when a word maps to no tribe", () => {
    expect(() =>
      validateWordMappings([{ word: "Orphan", tribes: [] }]),
    ).toThrow(/Orphan/);
  });
});
