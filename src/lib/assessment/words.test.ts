import { describe, it, expect } from "vitest";
import { getTribeBySlug } from "@/lib/tribes";
import { words, validateWordMappings, MIN_WORDS, MAX_WORDS } from "@/lib/assessment/words";

describe("word data", () => {
  it("transcribes the full flat list (74 words, per the enumerated source)", () => {
    expect(words.length).toBe(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word.toLowerCase()));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to between one and three tribes", () => {
    for (const { word, tribes } of words) {
      expect(tribes.length, word).toBeGreaterThanOrEqual(1);
      expect(tribes.length, word).toBeLessThanOrEqual(3);
    }
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list — every slug resolves against `tribes`", () => {
    expect(() => validateWordMappings()).not.toThrow();
    for (const { tribes } of words) {
      for (const slug of tribes) {
        expect(getTribeBySlug(slug)).toBeDefined();
      }
    }
  });

  it("fails loudly when a mapping references a slug that does not exist", () => {
    expect(() =>
      validateWordMappings([{ word: "Fabricated", tribes: ["not-a-tribe"] }]),
    ).toThrow(/not-a-tribe/);
  });

  it("fails when a word maps to no tribe at all", () => {
    expect(() =>
      validateWordMappings([{ word: "Orphan", tribes: [] }]),
    ).toThrow();
  });
});
