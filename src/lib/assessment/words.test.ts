import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  wordList,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("contains every word enumerated in ASSESSMENT_DESIGN.md", () => {
    // The doc's flat list and Tribe Mapping table both enumerate 74 distinct
    // words; its "Total: 73 words" summary line is an off-by-one miscount. We
    // transcribe the enumerated mapping faithfully (74), not the wrong total.
    expect(words).toHaveLength(74);
    expect(wordList).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    expect(new Set(wordList).size).toBe(wordList.length);
  });

  it("maps every word to one or more real tribe slugs", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const { word, tribes: mapped } of words) {
      expect(mapped.length, word).toBeGreaterThan(0);
      for (const slug of mapped) {
        expect(validSlugs.has(slug), `${word} → ${slug}`).toBe(true);
      }
    }
  });

  it("exposes the documented 8–15 selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the shipped mapping data", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("throws when a mapped slug does not exist in tribes", () => {
    const bad: WordMapping[] = [{ word: "Imaginary", tribes: ["nonexistent"] }];
    expect(() => validateWordMappings(bad)).toThrow(/unknown tribe slug/);
  });

  it("throws when a word maps to no tribes", () => {
    const bad: WordMapping[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/no tribes/);
  });

  it("throws on a duplicate word", () => {
    const bad: WordMapping[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordMappings(bad)).toThrow(/Duplicate word/);
  });
});
