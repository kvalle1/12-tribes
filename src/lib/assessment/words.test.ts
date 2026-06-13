import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  AssessmentWord,
  MAX_SELECTIONS,
  MIN_SELECTIONS,
  validateWordMappings,
  words,
} from "./words";

describe("word data", () => {
  it("contains every word from the mapping table", () => {
    // ASSESSMENT_DESIGN.md's flat list and mapping table both enumerate 74
    // words (they agree with each other); only the doc's "Total: 73 words"
    // summary line is an off-by-one. We transcribe the actual mapping.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word.toLowerCase()));
    expect(unique.size).toBe(words.length);
  });

  it("exposes the 8–15 selection range", () => {
    expect(MIN_SELECTIONS).toBe(8);
    expect(MAX_SELECTIONS).toBe(15);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word list", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("confirms every mapped slug resolves against tribes", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("throws loudly when a word references an unknown tribe slug", () => {
    const bad: AssessmentWord[] = [{ word: "Bogus", tribes: ["atlantis"] }];
    expect(() => validateWordMappings(bad)).toThrow(/atlantis/);
  });

  it("throws when a word maps to no tribes", () => {
    const bad: AssessmentWord[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/no tribes/);
  });
});
