import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  wordWeight,
  validateWords,
  MIN_WORDS,
  MAX_WORDS,
  type AssessmentWord,
} from "./words";

describe("word data", () => {
  it("is the full word list from ASSESSMENT_DESIGN.md", () => {
    // The design doc's prose list and mapping table both contain 74 distinct
    // words (identical sets); its "Total: 73 words" summary line is an off-by-one
    // miscount. We transcribe all 74 mapped words faithfully.
    expect(words).toHaveLength(74);
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("wordWeight", () => {
  it("gives a solo word a full point", () => {
    const solo: AssessmentWord = { word: "Authoritative", tribes: ["judah"] };
    expect(wordWeight(solo)).toBe(1);
  });

  it("splits a shared (two-tribe) word into 0.5 per tribe", () => {
    const shared: AssessmentWord = { word: "Bold", tribes: ["judah", "reuben"] };
    expect(wordWeight(shared)).toBe(0.5);
  });

  it("splits a three-tribe word into 0.5 per tribe as well", () => {
    const zealous = words.find((w) => w.word === "Zealous")!;
    expect(zealous.tribes).toHaveLength(3);
    expect(wordWeight(zealous)).toBe(0.5);
  });
});

describe("validateWords", () => {
  it("passes on the real word data — every mapped slug resolves", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    const bad: AssessmentWord[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    expect(() => validateWords(bad)).toThrow(/unknown tribe slug "atlantis"/);
  });

  it("fails loudly on a duplicated word", () => {
    const dup: AssessmentWord[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWords(dup)).toThrow(/duplicate word/);
  });

  it("fails loudly on a word with no tribe mapping", () => {
    const empty: AssessmentWord[] = [{ word: "Lonely", tribes: [] }];
    expect(() => validateWords(empty)).toThrow(/no tribe mapping/);
  });

  it("only ever references slugs that exist in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const { tribes: mapped } of words) {
      for (const slug of mapped) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });
});
