import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  validateAssessmentWords,
  MIN_WORDS,
  MAX_WORDS,
  type AssessmentWord,
} from "@/lib/assessment/words";

describe("word data", () => {
  it("contains the full transcribed list (74 entries, per the mapping table)", () => {
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to one or more real tribe slugs", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateAssessmentWords", () => {
  it("passes for the canonical word data", () => {
    expect(() => validateAssessmentWords()).not.toThrow();
  });

  it("throws loudly when a word references an unknown tribe slug", () => {
    const bad: AssessmentWord[] = [{ word: "Bogus", tribes: ["not-a-tribe"] }];
    expect(() => validateAssessmentWords(bad)).toThrow(/not-a-tribe/);
  });

  it("throws when a word maps to no tribes", () => {
    const bad: AssessmentWord[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateAssessmentWords(bad)).toThrow(/Orphan/);
  });
});
