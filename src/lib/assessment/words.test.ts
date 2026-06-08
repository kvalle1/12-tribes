import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  validateWordData,
  wordWeight,
  MIN_WORDS,
  MAX_WORDS,
  type AssessmentWord,
} from "@/lib/assessment/words";

describe("word data", () => {
  it("transcribes the full word list (74 distinct adjectives)", () => {
    expect(words).toHaveLength(74);
    expect(new Set(words.map((w) => w.word)).size).toBe(74);
  });

  it("maps every word to one or more real tribe slugs", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      expect(entry.tribeSlugs.length).toBeGreaterThan(0);
      for (const slug of entry.tribeSlugs) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("covers all 12 tribes", () => {
    const mapped = new Set(words.flatMap((w) => w.tribeSlugs));
    expect(mapped.size).toBe(tribes.length);
  });

  it("exposes the 8–15 selection band", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("wordWeight", () => {
  it("gives a solo word weight 1 and a shared word 0.5 to each tribe", () => {
    const solo = words.find((w) => w.tribeSlugs.length === 1)!;
    const shared = words.find((w) => w.tribeSlugs.length === 2)!;
    expect(wordWeight(solo)).toBe(1);
    expect(wordWeight(shared)).toBe(0.5);
  });

  it("splits the lone three-tribe word evenly (1/3 each)", () => {
    const zealous = words.find((w) => w.word === "Zealous")!;
    expect(zealous.tribeSlugs).toHaveLength(3);
    expect(wordWeight(zealous)).toBeCloseTo(1 / 3);
  });
});

describe("validateWordData", () => {
  it("passes for the real word data", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a word references an unknown tribe slug", () => {
    const bad: AssessmentWord[] = [{ word: "Bogus", tribeSlugs: ["atlantis"] }];
    expect(() => validateWordData(bad)).toThrow(/unknown tribe slug/i);
  });

  it("fails loudly on a duplicate word", () => {
    const bad: AssessmentWord[] = [
      { word: "Bold", tribeSlugs: ["judah"] },
      { word: "Bold", tribeSlugs: ["reuben"] },
    ];
    expect(() => validateWordData(bad)).toThrow(/duplicate/i);
  });

  it("fails loudly on a word with no tribes", () => {
    const bad: AssessmentWord[] = [{ word: "Empty", tribeSlugs: [] }];
    expect(() => validateWordData(bad)).toThrow(/no tribes/i);
  });
});
