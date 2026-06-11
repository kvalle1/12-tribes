import { describe, expect, it } from "vitest";
import { tribes } from "../tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  validateWordMappings,
  words,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("contains every word enumerated in ASSESSMENT_DESIGN.md", () => {
    // The doc's prose header reads "Total: 73 words", but the enumerated list
    // and the mapping table each contain 74 (the header is an off-by-one
    // miscount). We transcribe the actual enumerated data faithfully.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const mapping of words) {
      expect(mapping.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list (every slug resolves)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("only ever references slugs that exist in `tribes`", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const mapping of words) {
      for (const slug of mapping.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("throws loudly when a mapping references an unknown slug", () => {
    const bad: WordMapping[] = [{ word: "Made-up", tribes: ["nephilim"] }];
    expect(() => validateWordMappings(bad)).toThrow(/nephilim/);
  });

  it("throws when a word maps to no tribe", () => {
    const bad: WordMapping[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/maps to no tribe/);
  });
});
