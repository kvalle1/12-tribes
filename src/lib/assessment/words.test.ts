import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  SELECTION_MIN,
  SELECTION_MAX,
  findUnknownTribeSlugs,
  validateWordMappings,
  type AssessmentWord,
} from "./words";

describe("word data", () => {
  it("contains exactly the 73 words from ASSESSMENT_DESIGN.md", () => {
    expect(words).toHaveLength(73);
  });

  it("has no duplicate words", () => {
    const seen = new Set(words.map((w) => w.word));
    expect(seen.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const w of words) {
      expect(w.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("references only tribe slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const w of words) {
      for (const slug of w.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("covers all 12 tribes at least once", () => {
    const covered = new Set(words.flatMap((w) => w.tribes));
    expect(covered.size).toBe(tribes.length);
  });

  it("exposes the 8-15 selection constants", () => {
    expect(SELECTION_MIN).toBe(8);
    expect(SELECTION_MAX).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list (every slug resolves)", () => {
    expect(findUnknownTribeSlugs()).toEqual([]);
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad: AssessmentWord[] = [{ word: "Bogus", tribes: ["not-a-tribe"] }];
    expect(findUnknownTribeSlugs(bad)).toEqual(["not-a-tribe"]);
    expect(() => validateWordMappings(bad)).toThrow(/not-a-tribe/);
  });
});
