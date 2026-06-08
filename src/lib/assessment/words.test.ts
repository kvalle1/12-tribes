import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  MIN_WORDS,
  MAX_WORDS,
  validateWordMappings,
  type WordMapping,
} from "@/lib/assessment/words";

describe("word data", () => {
  // The "Tribe Mapping" table in ASSESSMENT_DESIGN.md has 74 rows. (The doc's
  // "Total: 73 words" header is an off-by-one typo — both the flat list and the
  // mapping table actually contain 74 words, including "Wise → Issachar".)
  it("transcribes the full mapping table (74 words)", () => {
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const seen = new Set(words.map((w) => w.word.toLowerCase()));
    expect(seen.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const { word, tribes: mapped } of words) {
      expect(mapped.length, `"${word}" should map to ≥1 tribe`).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("matches a few mappings against ASSESSMENT_DESIGN.md exactly", () => {
    const byWord = (w: string) => words.find((m) => m.word === w);
    // sole tribe
    expect(byWord("Aggressive")?.tribes).toEqual(["benjamin"]);
    expect(byWord("Wise")?.tribes).toEqual(["issachar"]);
    // two-tribe shared
    expect(byWord("Generous")?.tribes).toEqual(["zebulun", "asher"]);
    expect(byWord("Cautious")?.tribes).toEqual(["dan", "issachar"]);
    // the lone three-tribe word
    expect(byWord("Zealous")?.tribes).toEqual(["judah", "benjamin", "simeon"]);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list (every slug resolves against tribes)", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("every mapped slug exists in the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const { word, tribes: mapped } of words) {
      for (const slug of mapped) {
        expect(validSlugs.has(slug), `"${word}" → "${slug}"`).toBe(true);
      }
    }
  });

  it("fails loudly on an unknown tribe slug", () => {
    const bad: WordMapping[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    expect(() => validateWordMappings(bad)).toThrow(/atlantis/);
  });

  it("fails loudly on a word mapped to no tribe", () => {
    const bad: WordMapping[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/no tribe/);
  });
});
