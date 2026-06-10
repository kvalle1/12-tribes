import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  assessmentWords,
  findUnknownSlugs,
  MAX_WORDS,
  MIN_WORDS,
  validateWords,
} from "./words";

describe("word data", () => {
  it("contains every word enumerated in ASSESSMENT_DESIGN.md", () => {
    // The doc's summary line reads "Total: 73 words", but its flat list and its
    // word→tribe mapping table each enumerate 74 distinct words (they agree with
    // each other; only the summary count is off by one). We transcribe the
    // enumerated data faithfully — see the note in words.ts.
    expect(assessmentWords).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(assessmentWords.map((w) => w.word));
    expect(unique.size).toBe(assessmentWords.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const word of assessmentWords) {
      expect(word.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 selection constraint", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("slug validation", () => {
  it("resolves every mapped slug against the tribes source of truth", () => {
    expect(findUnknownSlugs()).toEqual([]);
    expect(() => validateWords()).not.toThrow();
  });

  it("reports slugs that do not exist in tribes", () => {
    const bad = [{ word: "Spurious", tribes: ["judah", "nonexistent"] }];
    expect(findUnknownSlugs(bad)).toEqual(["nonexistent"]);
  });

  it("fails loudly when a mapped slug is unknown", () => {
    const bad = [{ word: "Spurious", tribes: ["nonexistent"] }];
    expect(() => validateWords(bad)).toThrow(/nonexistent/);
  });

  it("only references slugs that exist (every tribe slug is a valid target)", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const word of assessmentWords) {
      for (const slug of word.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });
});
