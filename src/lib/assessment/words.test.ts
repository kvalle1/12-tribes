import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  MIN_WORDS,
  MAX_WORDS,
  validateWords,
  findUnknownTribeSlugs,
  type WordEntry,
} from "@/lib/assessment/words";

describe("word list", () => {
  it("contains every word enumerated in ASSESSMENT_DESIGN.md", () => {
    // The doc's headline says "73 words", but both its flat Word List and its
    // Tribe Mapping table enumerate the same 74 distinct words — the headline
    // is an off-by-one miscount. We transcribe the enumerated mapping faithfully.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("exposes the 8–15 selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWords", () => {
  it("does not throw — every mapped slug resolves against tribes", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    const bad: WordEntry[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    const errors = findUnknownTribeSlugs(bad, validSlugs);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("atlantis");
  });

  it("reports valid edges as no errors", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    expect(findUnknownTribeSlugs(words, validSlugs)).toEqual([]);
  });
});
