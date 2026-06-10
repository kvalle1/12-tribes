import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  WORDS,
  WORD_COUNT,
  MIN_WORDS,
  MAX_WORDS,
  validateWords,
  type AssessmentWord,
} from "./words";

describe("word data", () => {
  it("enumerates the full assessment list with a derived count", () => {
    // The design doc heads the list "73 words" but enumerates 74; we transcribe
    // the enumerated data and derive the count from it.
    expect(WORDS.length).toBe(74);
    expect(WORD_COUNT).toBe(WORDS.length);
  });

  it("exposes the selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("has no duplicate words", () => {
    const unique = new Set(WORDS.map((w) => w.word));
    expect(unique.size).toBe(WORDS.length);
  });

  it("maps every word to between one and three real tribes", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of WORDS) {
      expect(entry.tribes.length).toBeGreaterThanOrEqual(1);
      expect(entry.tribes.length).toBeLessThanOrEqual(3);
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("preserves the documented multi-tribe shares", () => {
    const byWord = (word: string) =>
      WORDS.find((w) => w.word === word) as AssessmentWord;
    expect(byWord("Bold").tribes).toEqual(["judah", "reuben"]);
    expect(byWord("Zealous").tribes).toEqual(["judah", "benjamin", "simeon"]);
  });
});

describe("validateWords", () => {
  it("accepts the live word data", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("fails loudly when a word maps to a slug that does not exist in tribes", () => {
    expect(() => validateWords([{ word: "Made-up", tribes: ["nope"] }])).toThrow(
      /unknown tribe slug "nope"/,
    );
  });

  it("fails loudly when a word maps to no tribe", () => {
    expect(() => validateWords([{ word: "Orphan", tribes: [] }])).toThrow(
      /maps to no tribe/,
    );
  });

  it("fails loudly on a duplicate word", () => {
    expect(() =>
      validateWords([
        { word: "Bold", tribes: ["judah"] },
        { word: "Bold", tribes: ["reuben"] },
      ]),
    ).toThrow(/appears more than once/);
  });
});
