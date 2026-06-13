import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  wordWeight,
  validateWordData,
  MIN_WORDS,
  MAX_WORDS,
  type AssessmentWord,
} from "@/lib/assessment/words";

describe("word data", () => {
  it("transcribes the full mapping table (74 entries, all unique)", () => {
    expect(words).toHaveLength(74);
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("weights a single-tribe word 1.0 and a shared word 0.5 per tribe", () => {
    expect(wordWeight({ word: "Courageous", tribes: ["judah"] })).toBe(1);
    expect(wordWeight({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(0.5);
    expect(
      wordWeight({ word: "Zealous", tribes: ["judah", "benjamin", "simeon"] }),
    ).toBe(0.5);
  });
});

describe("validateWordData", () => {
  it("passes for the real word list", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("references only slugs that exist in tribes.ts", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    const bad: AssessmentWord[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    expect(() => validateWordData(bad)).toThrow(/atlantis/);
  });

  it("fails loudly on a duplicate word", () => {
    const dup: AssessmentWord[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordData(dup)).toThrow(/Duplicate/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    const empty: AssessmentWord[] = [{ word: "Empty", tribes: [] }];
    expect(() => validateWordData(empty)).toThrow(/no tribe/);
  });
});
