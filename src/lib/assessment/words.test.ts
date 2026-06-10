import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  MAX_SELECTION,
  MIN_SELECTION,
  isSelectionInRange,
  mappingWeight,
  validateWordMappings,
  wordMappings,
  words,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("matches the transcribed word list (one entry per word, no duplicates)", () => {
    expect(new Set(words).size).toBe(words.length);
    // The "Tribe Mapping" table in ASSESSMENT_DESIGN.md has 74 rows (its "73"
    // header is off by one); transcription keeps every row.
    expect(words.length).toBe(74);
  });

  it("weights single-tribe words 1.0 and shared words 0.5", () => {
    const single = wordMappings.find((m) => m.word === "Courageous")!;
    const shared = wordMappings.find((m) => m.word === "Bold")!;
    const triple = wordMappings.find((m) => m.word === "Zealous")!;

    expect(mappingWeight(single)).toBe(1);
    expect(mappingWeight(shared)).toBe(0.5);
    // A word shared across three tribes still scores 0.5 to each.
    expect(triple.tribes).toHaveLength(3);
    expect(mappingWeight(triple)).toBe(0.5);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real data (every slug resolves against tribes.ts)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad: WordMapping[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    expect(() => validateWordMappings(bad)).toThrow(/atlantis/);
  });

  it("fails when a word maps to no tribe", () => {
    const bad: WordMapping[] = [{ word: "Empty", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/no tribe/);
  });

  it("fails on duplicate words", () => {
    const valid = new Set(tribes.map((t) => t.slug));
    const bad: WordMapping[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordMappings(bad, valid)).toThrow(/Duplicate/);
  });
});

describe("selection constants", () => {
  it("uses an 8–15 word range", () => {
    expect(MIN_SELECTION).toBe(8);
    expect(MAX_SELECTION).toBe(15);
  });

  it("gates submission to the allowed range", () => {
    expect(isSelectionInRange(7)).toBe(false);
    expect(isSelectionInRange(8)).toBe(true);
    expect(isSelectionInRange(15)).toBe(true);
    expect(isSelectionInRange(16)).toBe(false);
  });
});
