import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  wordMappings,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
  type WordMapping,
} from "./words";

describe("word list", () => {
  it("has exactly 74 words (the count actually enumerated in ASSESSMENT_DESIGN.md)", () => {
    // The design doc's summary line says "73", but its flat list and mapping
    // table both enumerate 74 distinct words — we transcribe the real data.
    expect(words).toHaveLength(74);
    expect(wordMappings).toHaveLength(74);
  });

  it("contains no duplicate words", () => {
    expect(new Set(words).size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const mapping of wordMappings) {
      expect(mapping.tribeSlugs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses the agreed selection range of 8–15", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list (every slug resolves against tribes)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("agrees with the tribe slugs declared in tribes.ts", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const mapping of wordMappings) {
      for (const slug of mapping.tribeSlugs) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad: WordMapping[] = [{ word: "Imaginary", tribeSlugs: ["atlantis"] }];
    expect(() => validateWordMappings(bad)).toThrow(/atlantis/);
  });
});
