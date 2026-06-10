import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  wordWeight,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
} from "./words";

describe("word data", () => {
  it("transcribes the full mapping table (74 entries)", () => {
    // The doc prose says "73" but its mapping table lists 74 consistent rows.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const seen = new Set(words.map((w) => w.word));
    expect(seen.size).toBe(words.length);
  });

  it("maps every word to between 1 and 3 tribes", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThanOrEqual(1);
      expect(entry.tribes.length).toBeLessThanOrEqual(3);
    }
  });

  it("matches representative mappings from ASSESSMENT_DESIGN.md", () => {
    const byWord = new Map(words.map((w) => [w.word, w.tribes]));
    expect(byWord.get("Aggressive")).toEqual(["benjamin"]);
    expect(byWord.get("Bold")).toEqual(["judah", "reuben"]);
    expect(byWord.get("Generous")).toEqual(["zebulun", "asher"]);
    // The single three-tribe word.
    expect(byWord.get("Zealous")).toEqual(["judah", "benjamin", "simeon"]);
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("wordWeight", () => {
  it("splits a word's total weight of 1.0 evenly across its tribes", () => {
    expect(wordWeight({ word: "x", tribes: ["judah"] })).toBe(1);
    expect(wordWeight({ word: "x", tribes: ["judah", "reuben"] })).toBe(0.5);
    expect(
      wordWeight({ word: "x", tribes: ["judah", "benjamin", "simeon"] }),
    ).toBeCloseTo(1 / 3);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word data (every slug resolves)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("only references slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    expect(() =>
      validateWordMappings([{ word: "Fake", tribes: ["atlantis"] }]),
    ).toThrowError(/Fake.*atlantis/);
  });

  it("fails loudly when a word maps to no tribes", () => {
    expect(() =>
      validateWordMappings([{ word: "Orphan", tribes: [] }]),
    ).toThrowError(/Orphan/);
  });
});
