import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
} from "./words";

describe("word data", () => {
  it("transcribes the full design-doc mapping table (74 rows)", () => {
    // The doc's prose says "73", but its mapping table lists 74 rows.
    expect(words).toHaveLength(74);
  });

  it("has a non-empty, unique word for every entry", () => {
    const seen = new Set<string>();
    for (const { word } of words) {
      expect(word.trim()).not.toBe("");
      expect(seen.has(word)).toBe(false);
      seen.add(word);
    }
  });

  it("maps every word to at least one tribe", () => {
    for (const { word, tribes: slugs } of words) {
      expect(slugs.length, `${word} should map to a tribe`).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 selection constraint", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word data — every slug resolves against tribes", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("confirms every real slug exists in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const { tribes: slugs } of words) {
      for (const slug of slugs) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a word maps to an unknown slug", () => {
    expect(() =>
      validateWordMappings([{ word: "Bogus", tribes: ["not-a-tribe"] }]),
    ).toThrow(/not-a-tribe/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    expect(() =>
      validateWordMappings([{ word: "Orphan", tribes: [] }]),
    ).toThrow(/Orphan/);
  });
});
