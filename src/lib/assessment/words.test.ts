import { describe, it, expect } from "vitest";
import {
  assessmentWords,
  invalidSlugsIn,
  assertValidWordData,
  MIN_SELECTION,
  MAX_SELECTION,
} from "./words";

describe("assessment word data", () => {
  it("matches the mapping table: 74 distinct words", () => {
    // The doc header miscounts as 73; the mapping table itself enumerates 74.
    expect(assessmentWords.length).toBe(74);
    const unique = new Set(assessmentWords.map((w) => w.word));
    expect(unique.size).toBe(74);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of assessmentWords) {
      expect(entry.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_SELECTION).toBe(8);
    expect(MAX_SELECTION).toBe(15);
  });
});

describe("word→slug validation", () => {
  it("every referenced slug resolves against the tribes source of truth", () => {
    expect(invalidSlugsIn(assessmentWords)).toEqual([]);
    expect(() => assertValidWordData()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    expect(invalidSlugsIn([{ word: "Fake", tribes: ["nope"] }])).toEqual([
      "nope",
    ]);
  });
});
