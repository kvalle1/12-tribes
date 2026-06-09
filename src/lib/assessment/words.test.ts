import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  wordList,
  WORD_COUNT,
  MIN_SELECTIONS,
  MAX_SELECTIONS,
  validateWordMappings,
  type WordMapping,
} from "@/lib/assessment/words";

describe("word data", () => {
  it("transcribes all 74 words from ASSESSMENT_DESIGN.md (the doc header's '73' is off by one)", () => {
    expect(WORD_COUNT).toBe(74);
    expect(wordList()).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const names = wordList();
    expect(new Set(names).size).toBe(names.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const { word, tribes: slugs } of words) {
      expect(slugs.length, `${word} should map to a tribe`).toBeGreaterThan(0);
    }
  });

  it("covers all 12 tribes so normalization never divides by zero", () => {
    const mapped = new Set(words.flatMap((m) => m.tribes));
    for (const tribe of tribes) {
      expect(mapped.has(tribe.slug), `${tribe.slug} should have words`).toBe(
        true,
      );
    }
  });

  it("exposes the 8–15 selection constraint", () => {
    expect(MIN_SELECTIONS).toBe(8);
    expect(MAX_SELECTIONS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word data (every slug resolves against tribes)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad: WordMapping[] = [{ word: "Bogus", tribes: ["not-a-tribe"] }];
    expect(() => validateWordMappings(bad)).toThrow(/not-a-tribe/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    const bad: WordMapping[] = [{ word: "Empty", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/Empty/);
  });
});
