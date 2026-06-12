import { describe, it, expect } from "vitest";
import { words, validateWordMappings, MIN_WORDS, MAX_WORDS } from "./words";
import { tribes } from "@/lib/tribes";

describe("assessment word data", () => {
  it("transcribes the full mapping table, each word mapped to at least one tribe", () => {
    expect(words).toHaveLength(74);
    for (const m of words) {
      expect(m.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 soft selection range", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("contains no duplicate words", () => {
    const unique = new Set(words.map((m) => m.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps only to real tribe slugs from the tribes source of truth", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const m of words) {
      for (const slug of m.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    expect(() =>
      validateWordMappings([{ word: "Bogus", tribes: ["atlantis"] }]),
    ).toThrow(/atlantis/);
  });
});
