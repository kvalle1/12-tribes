import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  validateWordData,
  WORD_COUNT,
  MIN_WORDS,
  MAX_WORDS,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("has exactly the 73-word list from ASSESSMENT_DESIGN.md", () => {
    expect(words).toHaveLength(WORD_COUNT);
    expect(WORD_COUNT).toBe(73);
  });

  it("contains no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const { word, tribes: slugs } of words) {
      expect(slugs.length, `"${word}" should map to a tribe`).toBeGreaterThan(0);
    }
  });

  it("only references slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const { word, tribes: slugs } of words) {
      for (const slug of slugs) {
        expect(validSlugs.has(slug), `"${word}" → "${slug}"`).toBe(true);
      }
    }
  });

  it("exposes selection bounds of 8–15 words", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordData", () => {
  it("passes for the real word list", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a word maps to a slug that does not exist", () => {
    const drifted: WordMapping[] = [
      { word: "Aggressive", tribes: ["benjamin"] },
      { word: "Phantom", tribes: ["nonexistent-tribe"] },
    ];
    expect(() => validateWordData(drifted)).toThrow(/nonexistent-tribe/);
  });

  it("fails loudly on a duplicate word", () => {
    const dupes: WordMapping[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordData(dupes)).toThrow(/[Dd]uplicate/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    const orphan: WordMapping[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordData(orphan)).toThrow(/no tribe/);
  });
});
