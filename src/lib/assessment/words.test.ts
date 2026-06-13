import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  validateWordMappings,
  wordMappings,
  words,
  wordWeight,
} from "./words";

describe("word data", () => {
  it("has no duplicate words", () => {
    expect(new Set(words).size).toBe(words.length);
  });

  it("matches the ASSESSMENT_DESIGN mapping table (74 distinct words)", () => {
    expect(words.length).toBe(74);
  });

  it("maps every word to at least one tribe", () => {
    for (const mapping of wordMappings) {
      expect(mapping.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("weights solo words 1.0 and shared words 0.5", () => {
    const solo = wordMappings.find((m) => m.word === "Aggressive")!;
    const shared = wordMappings.find((m) => m.word === "Bold")!;
    const threeWay = wordMappings.find((m) => m.word === "Zealous")!;
    expect(wordWeight(solo)).toBe(1);
    expect(wordWeight(shared)).toBe(0.5);
    // A word shared across three tribes still contributes 0.5 to each.
    expect(threeWay.tribes).toEqual(["judah", "benjamin", "simeon"]);
    expect(wordWeight(threeWay)).toBe(0.5);
  });

  it("exposes a sensible selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
    expect(MIN_WORDS).toBeLessThan(MAX_WORDS);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real data (every slug resolves against tribes)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("only references slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const mapping of wordMappings) {
      for (const slug of mapping.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a mapped slug does not exist", () => {
    expect(() =>
      validateWordMappings([{ word: "Bogus", tribes: ["nonexistent-tribe"] }]),
    ).toThrow(/nonexistent-tribe/);
  });

  it("fails loudly when a word maps to no tribes", () => {
    expect(() =>
      validateWordMappings([{ word: "Empty", tribes: [] }]),
    ).toThrow(/no tribes/);
  });
});
