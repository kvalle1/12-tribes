import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  wordWeight,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
  type AssessmentWord,
} from "./words";

describe("word data", () => {
  it("transcribes the full adjective list (74 words as written in the doc)", () => {
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("wordWeight", () => {
  it("gives a solo word the full point", () => {
    expect(wordWeight({ word: "Aggressive", tribes: ["benjamin"] })).toBe(1);
  });

  it("splits a shared pair 0.5 each (the ADR-0001 rule)", () => {
    expect(wordWeight({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(0.5);
  });

  it("splits a three-way word evenly (1/3 each)", () => {
    expect(
      wordWeight({ word: "Zealous", tribes: ["judah", "benjamin", "simeon"] }),
    ).toBeCloseTo(1 / 3);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list (every slug resolves against tribes)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a word references a slug not in tribes", () => {
    const bad: AssessmentWord[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    expect(() => validateWordMappings(bad)).toThrow(/atlantis/);
  });

  it("fails loudly on a word mapped to no tribe", () => {
    const bad: AssessmentWord[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/no tribe/);
  });

  it("fails loudly on a duplicate word", () => {
    const bad: AssessmentWord[] = [
      { word: "Twin", tribes: ["judah"] },
      { word: "Twin", tribes: ["levi"] },
    ];
    expect(() => validateWordMappings(bad)).toThrow(/Duplicate/);
  });

  it("only references slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });
});
