import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  wordWeight,
  validateWords,
  findUnknownSlugs,
  MIN_WORDS,
  MAX_WORDS,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("transcribes the full mapping table from ASSESSMENT_DESIGN.md", () => {
    // The mapping table enumerates 74 distinct words (the doc's "73" label is a
    // known stale count — see the module note).
    expect(words).toHaveLength(74);
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(74);
  });

  it("maps every word to at least one tribe", () => {
    for (const mapping of words) {
      expect(mapping.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("weights a single-tribe word at 1 and a shared word at 0.5", () => {
    const courageous = words.find((w) => w.word === "Courageous")!; // judah only
    const bold = words.find((w) => w.word === "Bold")!; // judah + reuben
    expect(wordWeight(courageous)).toBe(1);
    expect(wordWeight(bold)).toBe(0.5);
  });
});

describe("validateWords", () => {
  it("passes for the real word mapping (every slug resolves against tribes)", () => {
    expect(() => validateWords()).not.toThrow();
    expect(findUnknownSlugs()).toEqual([]);
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad: WordMapping[] = [{ word: "Bogus", tribes: ["nosuchtribe"] }];
    expect(() => validateWords(bad, tribes)).toThrow(/unknown tribe slug/i);
    expect(findUnknownSlugs(bad, tribes)).toEqual([["Bogus", "nosuchtribe"]]);
  });
});
