import { describe, expect, it } from "vitest";
import { getTribeBySlug } from "@/lib/tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  isSelectionInRange,
  validateWordMappings,
  wordMappings,
  words,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("transcribes the full word list (74 entries, matching the mapping table)", () => {
    // ASSESSMENT_DESIGN.md's header says 73, but it enumerates 74 — see words.ts.
    expect(words).toHaveLength(74);
    expect(wordMappings).toHaveLength(74);
  });

  it("has no duplicate words and the flat list mirrors the mapping", () => {
    expect(new Set(words).size).toBe(words.length);
    expect(words).toEqual(wordMappings.map((m) => m.word));
  });

  it("maps every word to at least one real tribe slug", () => {
    for (const { word, tribes } of wordMappings) {
      expect(tribes.length, word).toBeGreaterThan(0);
      for (const slug of tribes) {
        expect(getTribeBySlug(slug), `${word} → ${slug}`).toBeDefined();
      }
    }
  });
});

describe("validateWordMappings", () => {
  it("passes on the real word data", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a word maps to a slug that does not exist in tribes", () => {
    const bad: WordMapping[] = [{ word: "Mystery", tribes: ["atlantis"] }];
    expect(() => validateWordMappings(bad)).toThrow(/atlantis/);
  });

  it("fails loudly on a duplicate word", () => {
    const bad: WordMapping[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordMappings(bad)).toThrow(/Duplicate/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    const bad: WordMapping[] = [{ word: "Empty", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/no tribe/);
  });
});

describe("selection constants", () => {
  it("exposes the 8–15 word range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("gates submission to the range", () => {
    expect(isSelectionInRange(MIN_WORDS - 1)).toBe(false);
    expect(isSelectionInRange(MIN_WORDS)).toBe(true);
    expect(isSelectionInRange(MAX_WORDS)).toBe(true);
    expect(isSelectionInRange(MAX_WORDS + 1)).toBe(false);
  });
});
