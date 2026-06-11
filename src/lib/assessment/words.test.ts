import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  validateWords,
  weightPerTribe,
  wordList,
  words,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("matches the ASSESSMENT_DESIGN.md list (74 distinct words)", () => {
    expect(words).toHaveLength(74);
    expect(new Set(wordList).size).toBe(74);
  });

  it("exposes the soft selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("maps every word to at least one tribe", () => {
    for (const mapping of words) {
      expect(mapping.tribes.length).toBeGreaterThan(0);
    }
  });

  it("splits a word's single point equally among its tribes", () => {
    const solo = words.find((w) => w.tribes.length === 1)!;
    const shared = words.find((w) => w.tribes.length === 2)!;
    const triple = words.find((w) => w.tribes.length === 3)!;

    expect(weightPerTribe(solo)).toBe(1);
    expect(weightPerTribe(shared)).toBe(0.5);
    expect(weightPerTribe(triple)).toBeCloseTo(1 / 3);
  });
});

describe("validateWords", () => {
  it("passes for the real word data (every slug resolves)", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("fails loudly when a word references an unknown tribe slug", () => {
    const bad: WordMapping[] = [{ word: "Made-up", tribes: ["atlantis"] }];
    expect(() => validateWords(bad)).toThrow(/unknown tribe slug/i);
  });

  it("fails loudly when a word maps to no tribe", () => {
    const bad: WordMapping[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWords(bad)).toThrow(/no tribe/i);
  });

  it("fails loudly on duplicate words", () => {
    const bad: WordMapping[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWords(bad)).toThrow(/duplicate/i);
  });

  it("only references slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const mapping of words) {
      for (const slug of mapping.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });
});
