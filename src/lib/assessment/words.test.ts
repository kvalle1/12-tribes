import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  SELECTION_MAX,
  SELECTION_MIN,
  validateWords,
  words,
  type AssessmentWord,
} from "./words";

describe("word data", () => {
  it("matches the ASSESSMENT_DESIGN mapping table (74 mapped rows)", () => {
    // The doc's prose says "73 words" but its mapping table enumerates 74.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((entry) => entry.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    expect(words.every((entry) => entry.tribes.length >= 1)).toBe(true);
  });

  it("maps every referenced slug to a real tribe", () => {
    const validSlugs = new Set(tribes.map((tribe) => tribe.slug));
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("models shared words, including the three-way 'Zealous'", () => {
    const generous = words.find((entry) => entry.word === "Generous");
    expect(generous?.tribes).toEqual(["zebulun", "asher"]);

    const zealous = words.find((entry) => entry.word === "Zealous");
    expect(zealous?.tribes).toEqual(["judah", "benjamin", "simeon"]);
  });

  it("exposes the 8–15 selection constants", () => {
    expect(SELECTION_MIN).toBe(8);
    expect(SELECTION_MAX).toBe(15);
  });
});

describe("validateWords", () => {
  it("passes for the real word list", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad: AssessmentWord[] = [{ word: "Made-up", tribes: ["atlantis"] }];
    expect(() => validateWords(bad)).toThrow(/atlantis/);
  });

  it("fails when a word has no tribe mapping", () => {
    const bad: AssessmentWord[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWords(bad)).toThrow(/not mapped/);
  });

  it("fails on a duplicate word", () => {
    const bad: AssessmentWord[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWords(bad)).toThrow(/Duplicate/);
  });
});
