import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  wordWeight,
  validateWordData,
  findUnknownTribeSlugs,
  MIN_WORDS,
  MAX_WORDS,
  type AssessmentWord,
} from "./words";

describe("assessment word data", () => {
  it("contains every word from the ASSESSMENT_DESIGN.md mapping table", () => {
    // The mapping table (and the flat list above it) enumerate 74 distinct
    // words. The doc's "Total: 73 words" summary line is an off-by-one miscount
    // of that table; the enumerated mapping is the scoring source of truth, so
    // we transcribe all 74 rows faithfully.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const w of words) {
      expect(w.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("only references tribe slugs that exist in the tribes source of truth", () => {
    expect(findUnknownTribeSlugs()).toEqual([]);
    expect(() => validateWordData()).not.toThrow();
  });

  it("uses the documented selection range (8–15)", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordData", () => {
  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad: AssessmentWord[] = [{ word: "Nonsense", tribes: ["atlantis"] }];
    expect(findUnknownTribeSlugs(bad)).toEqual(["atlantis"]);
    expect(() => validateWordData(bad)).toThrow(/atlantis/);
  });
});

describe("wordWeight", () => {
  it("weights a sole-mapped word as 1 point", () => {
    expect(wordWeight({ word: "Honorable", tribes: ["judah"] })).toBe(1);
  });

  it("weights a shared word as 0.5 per tribe", () => {
    expect(wordWeight({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(0.5);
  });

  it("weights the three-tribe word as 0.5 per tribe", () => {
    const zealous = words.find((w) => w.word === "Zealous")!;
    expect(zealous.tribes).toHaveLength(3);
    expect(wordWeight(zealous)).toBe(0.5);
  });
});

describe("tribe coverage", () => {
  it("gives every tribe at least one word", () => {
    for (const t of tribes) {
      const covered = words.some((w) => w.tribes.includes(t.slug));
      expect(covered, `tribe ${t.slug} has no words`).toBe(true);
    }
  });
});
