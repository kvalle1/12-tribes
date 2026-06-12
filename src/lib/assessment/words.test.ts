import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  weightPerTribe,
  findInvalidSlugs,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
} from "./words";

describe("word data", () => {
  it("transcribes the full word list from ASSESSMENT_DESIGN.md (74 words)", () => {
    // The design doc's prose says "73" but its list and mapping table both
    // contain 74 distinct words; we transcribe the real content.
    expect(words).toHaveLength(74);
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(74);
  });

  it("maps every word to between one and three tribes", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThanOrEqual(1);
      expect(entry.tribes.length).toBeLessThanOrEqual(3);
    }
  });

  it("splits each word's weight of 1.0 evenly across its tribes", () => {
    const sole = words.find((w) => w.word === "Courageous")!; // judah only
    const shared = words.find((w) => w.word === "Bold")!; // judah + reuben
    const triple = words.find((w) => w.word === "Zealous")!; // 3 tribes

    expect(weightPerTribe(sole)).toBe(1);
    expect(weightPerTribe(shared)).toBe(0.5);
    expect(weightPerTribe(triple)).toBeCloseTo(1 / 3, 10);
  });

  it("exposes the 8–15 selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list (every slug resolves against tribes)", () => {
    expect(findInvalidSlugs()).toEqual([]);
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("references only slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad = [{ word: "Made-up", tribes: ["judah", "nonexistent"] }];
    expect(findInvalidSlugs(bad)).toEqual(["nonexistent"]);
    expect(() => validateWordMappings(bad)).toThrow(/nonexistent/);
  });
});
