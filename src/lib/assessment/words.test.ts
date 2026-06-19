import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  MIN_WORDS,
  MAX_WORDS,
  words,
  wordMappings,
  validateWords,
  WordMappingValidationError,
  type WordMapping,
} from "@/lib/assessment/words";

describe("word data", () => {
  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("transcribes every word from the design doc's list/table", () => {
    // ASSESSMENT_DESIGN.md's summary says 73 but its actual list and mapping
    // table both enumerate 74 unique words; we transcribe the real content.
    expect(wordMappings).toHaveLength(74);
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    expect(new Set(words).size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const { word, tribes: slugs } of wordMappings) {
      expect(slugs.length, word).toBeGreaterThan(0);
    }
  });

  it("treats Zealous as a three-way shared word", () => {
    const zealous = wordMappings.find((m) => m.word === "Zealous");
    expect(zealous?.tribes).toEqual(["judah", "benjamin", "simeon"]);
  });
});

describe("validateWords", () => {
  it("passes for the real mapping (every slug resolves against tribes)", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("covers all 12 tribes across the mapping", () => {
    const referenced = new Set(wordMappings.flatMap((m) => m.tribes));
    for (const t of tribes) {
      expect(referenced.has(t.slug), t.slug).toBe(true);
    }
  });

  it("throws naming the offending word→slug pair on a bad slug", () => {
    const bad: WordMapping[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    expect(() => validateWords(bad)).toThrow(WordMappingValidationError);
    expect(() => validateWords(bad)).toThrow(/"Bogus" → "atlantis"/);
  });
});
