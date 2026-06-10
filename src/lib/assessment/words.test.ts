import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  MIN_WORDS,
  MAX_WORDS,
  validateWordData,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("transcribes the full flat list from ASSESSMENT_DESIGN.md", () => {
    // The design doc's prose says "73 words", but the actual list (and the
    // mapping table) both contain 74 distinct words — the stale count was
    // flagged in PR #1. We transcribe what is actually there.
    expect(words.length).toBe(74);
  });

  it("has no duplicate words", () => {
    const seen = new Set(words.map((w) => w.word.toLowerCase()));
    expect(seen.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const w of words) {
      expect(w.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes a soft selection range of 8–15 words", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordData", () => {
  it("passes for the real word data", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("confirms every mapped slug resolves against the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const w of words) {
      for (const slug of w.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a word references an unknown tribe slug", () => {
    const bad: WordMapping[] = [{ word: "Bogus", tribes: ["not-a-tribe"] }];
    expect(() => validateWordData(bad)).toThrow(/not-a-tribe/);
  });

  it("fails loudly when a word maps to no tribe", () => {
    const bad: WordMapping[] = [{ word: "Lonely", tribes: [] }];
    expect(() => validateWordData(bad)).toThrow(/Lonely/);
  });
});
