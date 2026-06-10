import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  wordList,
  MIN_WORDS,
  MAX_WORDS,
  validateWordMappings,
} from "./words";

describe("word data", () => {
  it("contains exactly the 73 words from ASSESSMENT_DESIGN.md", () => {
    expect(words).toHaveLength(73);
    expect(wordList).toHaveLength(73);
  });

  it("has no duplicate words", () => {
    expect(new Set(wordList).size).toBe(73);
  });

  it("exposes the 8–15 selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("maps every word to at least one tribe", () => {
    for (const { word, tribes: mapped } of words) {
      expect(mapped.length, word).toBeGreaterThan(0);
    }
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word data (every slug resolves)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a word maps to a slug not in tribes", () => {
    const bad = [{ word: "Bogus", tribes: ["judah", "nonexistent"] }];
    expect(() => validateWordMappings(bad)).toThrow(/nonexistent/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    expect(() => validateWordMappings([{ word: "Empty", tribes: [] }])).toThrow(
      /Empty/,
    );
  });

  it("recognizes every real tribe slug as valid", () => {
    const slugs = new Set(tribes.map((t) => t.slug));
    for (const { tribes: mapped } of words) {
      for (const slug of mapped) {
        expect(slugs.has(slug), slug).toBe(true);
      }
    }
  });
});
