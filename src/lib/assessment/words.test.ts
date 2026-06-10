import { describe, expect, it } from "vitest";
import { tribes } from "../tribes";
import { isShared, MAX_WORDS, MIN_WORDS, validateWords, words } from "./words";

describe("word data", () => {
  it("transcribes the full mapping table from ASSESSMENT_DESIGN.md (74 words)", () => {
    // The doc's prose says "73 words", but its mapping table lists 74; the
    // table is authoritative. See the note in words.ts.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("marks multi-tribe words as shared and single-tribe words as solo", () => {
    expect(isShared({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(true);
    expect(isShared({ word: "Honorable", tribes: ["judah"] })).toBe(false);
  });

  it("maps a sample of words to the expected tribe slugs", () => {
    const byWord = new Map(words.map((w) => [w.word, w.tribes]));
    expect(byWord.get("Aggressive")).toEqual(["benjamin"]);
    expect(byWord.get("Bold")).toEqual(["judah", "reuben"]);
    expect(byWord.get("Zealous")).toEqual(["judah", "benjamin", "simeon"]);
  });
});

describe("validateWords", () => {
  it("passes for the real word data (every slug resolves against tribes)", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("confirms every mapped slug exists in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const { tribes: slugs } of words) {
      for (const slug of slugs) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a word references an unknown tribe slug", () => {
    expect(() =>
      validateWords([{ word: "Bogus", tribes: ["nottribe"] }]),
    ).toThrow(/unknown tribe slug "nottribe"/);
  });

  it("fails loudly when a word maps to no tribes", () => {
    expect(() => validateWords([{ word: "Empty", tribes: [] }])).toThrow(
      /maps to no tribes/,
    );
  });
});
