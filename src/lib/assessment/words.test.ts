import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  wordList,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
} from "./words";

describe("word data", () => {
  it("transcribes every row of the ASSESSMENT_DESIGN mapping table (74 words)", () => {
    // The doc's summary line says 73, but its flat list and mapping table both
    // contain 74 rows (Wise -> Issachar included). We keep every real mapping.
    expect(words).toHaveLength(74);
    expect(wordList).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    expect(new Set(wordList).size).toBe(wordList.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const w of words) {
      expect(w.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes a sensible selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
    expect(MIN_WORDS).toBeLessThan(MAX_WORDS);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list (every slug resolves against tribes)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("every mapped slug exists in the tribes source of truth", () => {
    const slugs = new Set(tribes.map((t) => t.slug));
    for (const w of words) {
      for (const slug of w.tribes) {
        expect(slugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    expect(() =>
      validateWordMappings([{ word: "Bogus", tribes: ["atlantis"] }]),
    ).toThrow(/atlantis/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    expect(() =>
      validateWordMappings([{ word: "Orphan", tribes: [] }]),
    ).toThrow(/Orphan/);
  });
});
