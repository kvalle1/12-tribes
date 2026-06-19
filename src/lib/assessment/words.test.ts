import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  validateWords,
  WordMappingValidationError,
  weightFor,
  words,
  wordTribeMap,
} from "./words";

describe("word data", () => {
  it("matches the ASSESSMENT_DESIGN word count (74 unique words)", () => {
    // The doc summary says "73" but its list and table both enumerate 74; we
    // transcribe the actual content. This test pins that decision intentionally.
    expect(words.length).toBe(74);
    expect(new Set(words).size).toBe(74);
  });

  it("derives the flat list from the mapping so the two cannot drift", () => {
    expect(words).toEqual(Object.keys(wordTribeMap));
  });

  it("exposes the 8–15 selection constraint", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("treats a shared word as 0.5 per tribe and a solo word as 1", () => {
    expect(weightFor(["judah"])).toBe(1);
    expect(weightFor(["judah", "reuben"])).toBe(0.5);
    expect(weightFor(["judah", "benjamin", "simeon"])).toBe(0.5);
  });
});

describe("validateWords", () => {
  it("passes for the real mapping (every slug exists in tribes)", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("references only slugs that resolve against the tribes source of truth", () => {
    const valid = new Set(tribes.map((t) => t.slug));
    for (const slugs of Object.values(wordTribeMap)) {
      for (const slug of slugs) {
        expect(valid.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly, naming the bad pair, when a slug does not exist", () => {
    const original = wordTribeMap.Aggressive;
    wordTribeMap.Aggressive = ["nonexistent-tribe"];
    try {
      expect(() => validateWords()).toThrow(WordMappingValidationError);
      expect(() => validateWords()).toThrow(/Aggressive → nonexistent-tribe/);
    } finally {
      wordTribeMap.Aggressive = original;
    }
  });
});
