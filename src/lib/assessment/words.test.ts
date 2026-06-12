import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  MIN_SELECTED_WORDS,
  MAX_SELECTED_WORDS,
  assertWordDataValid,
} from "./words";

describe("word data", () => {
  it("transcribes the full word list from ASSESSMENT_DESIGN.md", () => {
    // The design doc's flat list and mapping table both contain the same 74
    // words (its "Total: 73" line is an off-by-one tally typo).
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThanOrEqual(1);
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

  it("exposes the selection bounds (min 8, max 15)", () => {
    expect(MIN_SELECTED_WORDS).toBe(8);
    expect(MAX_SELECTED_WORDS).toBe(15);
  });
});

describe("assertWordDataValid", () => {
  it("passes for the real word data", () => {
    expect(() => assertWordDataValid()).not.toThrow();
  });

  it("fails loudly when a word maps to a slug that does not exist in tribes", () => {
    expect(() =>
      assertWordDataValid([{ word: "Imaginary", tribes: ["nonexistent-tribe"] }]),
    ).toThrow(/nonexistent-tribe/);
  });

  it("fails loudly when a word maps to no tribe at all", () => {
    expect(() => assertWordDataValid([{ word: "Orphan", tribes: [] }])).toThrow(
      /Orphan/,
    );
  });
});
