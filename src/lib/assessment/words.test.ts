import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  isSelectionInRange,
  validateWordMappings,
  words,
  type AssessmentWord,
} from "./words";

describe("word data", () => {
  it("maps every word to at least one tribe", () => {
    for (const word of words) {
      expect(word.tribes.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate words", () => {
    const names = words.map((w) => w.word);
    expect(new Set(names).size).toBe(names.length);
  });

  it("references only tribe slugs that exist in the tribes source of truth", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("matches a few mappings transcribed from ASSESSMENT_DESIGN.md", () => {
    const byName = new Map(words.map((w) => [w.word, w.tribes]));
    expect(byName.get("Bold")).toEqual(["judah", "reuben"]);
    expect(byName.get("Courageous")).toEqual(["judah"]);
    // "Zealous" is the one word mapped to three tribes.
    expect(byName.get("Zealous")).toEqual(["judah", "benjamin", "simeon"]);
  });
});

describe("validateWordMappings", () => {
  it("throws loudly when a word references an unknown tribe slug", () => {
    const bad: AssessmentWord[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    expect(() => validateWordMappings(bad)).toThrow(/atlantis/);
  });

  it("throws when a word maps to no tribe", () => {
    const bad: AssessmentWord[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/Orphan/);
  });

  it("covers every tribe at least once", () => {
    const covered = new Set(words.flatMap((w) => w.tribes));
    for (const tribe of tribes) {
      expect(covered.has(tribe.slug)).toBe(true);
    }
  });
});

describe("selection constraints", () => {
  it("exposes the 8–15 soft range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("accepts counts inside the range and rejects counts outside it", () => {
    expect(isSelectionInRange(8)).toBe(true);
    expect(isSelectionInRange(15)).toBe(true);
    expect(isSelectionInRange(11)).toBe(true);
    expect(isSelectionInRange(7)).toBe(false);
    expect(isSelectionInRange(16)).toBe(false);
  });
});
