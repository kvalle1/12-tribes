import { describe, expect, it } from "vitest";
import { getTribeBySlug } from "../tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  WORD_COUNT,
  validateWordData,
  words,
} from "./words";

describe("word data", () => {
  it("contains exactly the words enumerated in ASSESSMENT_DESIGN.md", () => {
    // The design doc's header says 73, but its list and mapping table each
    // enumerate 74 distinct words; we transcribe the enumerated data.
    expect(words).toHaveLength(WORD_COUNT);
    expect(WORD_COUNT).toBe(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one real tribe slug", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
      for (const slug of entry.tribes) {
        expect(getTribeBySlug(slug)).toBeDefined();
      }
    }
  });

  it("exposes the 8–15 selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordData", () => {
  it("passes for the canonical word list", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    expect(() =>
      validateWordData([{ word: "Phantom", tribes: ["nonexistent-tribe"] }]),
    ).toThrow(/nonexistent-tribe/);
  });

  it("fails loudly on a word with no tribe mapping", () => {
    expect(() => validateWordData([{ word: "Orphan", tribes: [] }])).toThrow();
  });

  it("fails loudly on a duplicated word", () => {
    expect(() =>
      validateWordData([
        { word: "Bold", tribes: ["judah"] },
        { word: "Bold", tribes: ["reuben"] },
      ]),
    ).toThrow(/Bold/);
  });
});
