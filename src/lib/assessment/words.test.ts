import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  MAX_SELECTIONS,
  MIN_SELECTIONS,
  SHARED_WORD_WEIGHT,
  validateWordData,
  wordWeight,
  words,
  type AssessmentWord,
} from "./words";

describe("word data", () => {
  it("transcribes the full mapping table (74 entries) with no duplicates", () => {
    expect(words).toHaveLength(74);
    expect(new Set(words.map((w) => w.word)).size).toBe(74);
  });

  it("maps every word to at least one real tribe slug", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
      for (const slug of entry.tribes) {
        expect(validSlugs).toContain(slug);
      }
    }
  });

  it("uses a soft selection range of 8–15 words", () => {
    expect(MIN_SELECTIONS).toBe(8);
    expect(MAX_SELECTIONS).toBe(15);
  });
});

describe("wordWeight", () => {
  it("gives an exclusive word a full point", () => {
    expect(wordWeight({ word: "Aggressive", tribes: ["benjamin"] })).toBe(1);
  });

  it("gives a shared word 0.5 to each mapped tribe", () => {
    expect(wordWeight({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(
      SHARED_WORD_WEIGHT,
    );
    // Applies uniformly even to the lone three-tribe word.
    const zealous: AssessmentWord = {
      word: "Zealous",
      tribes: ["judah", "benjamin", "simeon"],
    };
    expect(wordWeight(zealous)).toBe(SHARED_WORD_WEIGHT);
  });
});

describe("validateWordData", () => {
  it("passes for the real, shipped word data", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a word references an unknown tribe slug", () => {
    const drifted: AssessmentWord[] = [{ word: "Made-up", tribes: ["gilead"] }];
    expect(() => validateWordData(drifted)).toThrow(/gilead/);
  });

  it("fails loudly on a duplicate word", () => {
    const dupes: AssessmentWord[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordData(dupes)).toThrow(/Duplicate/);
  });
});
