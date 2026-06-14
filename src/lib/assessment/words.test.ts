import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  assessmentWords,
  wordList,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
} from "./words";

describe("assessment word data", () => {
  it("contains exactly the words from the ASSESSMENT_DESIGN.md mapping table", () => {
    // The doc labels the list "73 words" but its mapping table holds 74 rows
    // (the label is an off-by-one); we follow the actual mapping.
    expect(assessmentWords).toHaveLength(74);
    expect(wordList).toHaveLength(74);
  });

  it("has a unique, non-empty word for every entry", () => {
    const unique = new Set(wordList.map((w) => w.toLowerCase()));
    expect(unique.size).toBe(wordList.length);
    expect(wordList.every((w) => w.trim().length > 0)).toBe(true);
  });

  it("maps every word to at least one tribe", () => {
    expect(assessmentWords.every((w) => w.tribes.length >= 1)).toBe(true);
  });

  it("defines a soft selection range of 8–15 words", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real mapping (every slug resolves against tribes)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a word references an unknown tribe slug", () => {
    expect(() =>
      validateWordMappings([{ word: "Bogus", tribes: ["not-a-tribe"] }]),
    ).toThrow(/not-a-tribe/);
  });

  it("fails loudly when a word maps to no tribe at all", () => {
    expect(() =>
      validateWordMappings([{ word: "Orphan", tribes: [] }]),
    ).toThrow(/Orphan/);
  });

  it("recognizes every real tribe slug as valid", () => {
    const realSlugs = tribes.map((t) => t.slug);
    expect(() =>
      validateWordMappings(realSlugs.map((slug) => ({ word: slug, tribes: [slug] }))),
    ).not.toThrow();
  });
});
