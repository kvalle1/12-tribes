import { describe, it, expect } from "vitest";
import { tribes } from "./tribes";
import {
  words,
  validateWordData,
  isShared,
  SELECTION_MIN,
  SELECTION_MAX,
  type WordEntry,
} from "./words";

describe("word data", () => {
  it("transcribes the full mapping table (74 distinct words)", () => {
    expect(words).toHaveLength(74);
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(74);
  });

  it("exposes the selection constants from the design doc", () => {
    expect(SELECTION_MIN).toBe(8);
    expect(SELECTION_MAX).toBe(15);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
    }
  });

  it("only references tribe slugs that exist in the source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("transcribes representative solo and shared mappings faithfully", () => {
    const byWord = new Map(words.map((w) => [w.word, w.tribes]));
    expect(byWord.get("Authoritative")).toEqual(["judah"]);
    expect(byWord.get("Bold")).toEqual(["judah", "reuben"]);
    // The lone three-tribe entry; the design doc marks all three as shared.
    expect(byWord.get("Zealous")).toEqual(["judah", "benjamin", "simeon"]);
  });

  it("treats multi-tribe words as shared and single-tribe words as solo", () => {
    expect(isShared({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(true);
    expect(isShared({ word: "Authoritative", tribes: ["judah"] })).toBe(false);
  });
});

describe("validateWordData", () => {
  it("passes for the real word data", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    const bad: WordEntry[] = [{ word: "Madeup", tribes: ["atlantis"] }];
    expect(() => validateWordData(bad)).toThrow(/atlantis/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    const bad: WordEntry[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordData(bad)).toThrow(/no tribe/);
  });

  it("fails loudly on a duplicate word", () => {
    const dup: WordEntry[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordData(dup)).toThrow(/Duplicate/);
  });
});
