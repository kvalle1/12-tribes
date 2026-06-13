import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  MIN_WORDS,
  MAX_WORDS,
  validateWords,
  findUnknownTribeSlugs,
  type AssessmentWord,
} from "./words";

describe("word data", () => {
  it("transcribes all 74 distinct words from ASSESSMENT_DESIGN.md", () => {
    expect(words).toHaveLength(74);
    const distinct = new Set(words.map((w) => w.word));
    expect(distinct.size).toBe(74);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
    }
  });

  it("preserves the documented multi-tribe mappings", () => {
    const find = (word: string) => words.find((w) => w.word === word);
    expect(find("Aggressive")?.tribes).toEqual(["benjamin"]);
    expect(find("Bold")?.tribes).toEqual(["judah", "reuben"]);
    expect(find("Generous")?.tribes).toEqual(["zebulun", "asher"]);
    // The single three-tribe word; each share scores 0.5.
    expect(find("Zealous")?.tribes).toEqual(["judah", "benjamin", "simeon"]);
  });

  it("exposes the soft selection range constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWords", () => {
  it("passes for the production word list", () => {
    expect(findUnknownTribeSlugs()).toEqual([]);
    expect(() => validateWords()).not.toThrow();
  });

  it("only references slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const broken: AssessmentWord[] = [
      { word: "Authoritative", tribes: ["judah"] },
      { word: "Bogus", tribes: ["gandalf"] },
    ];
    expect(findUnknownTribeSlugs(broken)).toEqual([
      { word: "Bogus", slug: "gandalf" },
    ]);
    expect(() => validateWords(broken)).toThrow(/gandalf/);
  });
});
