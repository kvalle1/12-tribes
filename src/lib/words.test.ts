import { describe, expect, it } from "vitest";
import { tribes } from "./tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  validateWordData,
  WORD_COUNT,
  words,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("contains exactly the words from the ASSESSMENT_DESIGN.md mapping table", () => {
    // The mapping table and the flat list in ASSESSMENT_DESIGN.md both hold 74
    // distinct words; the doc's "Total: 73 words" caption is an off-by-one.
    expect(WORD_COUNT).toBe(74);
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const w of words) {
      expect(w.tribes.length).toBeGreaterThan(0);
    }
  });

  it("maps every word only to slugs that exist in `tribes`", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const w of words) {
      for (const slug of w.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("exposes selection bounds of 8 and 15", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordData", () => {
  it("passes for the real word data", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not exist in `tribes`", () => {
    // Inject a bad mapping into the shared array, then restore it.
    const bad: WordMapping = { word: "__bogus__", tribes: ["not-a-tribe"] };
    words.push(bad);
    try {
      expect(() => validateWordData()).toThrowError(/not-a-tribe/);
    } finally {
      words.pop();
    }
  });
});
