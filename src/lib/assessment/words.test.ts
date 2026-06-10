import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  WORDS,
  MIN_SELECTIONS,
  MAX_SELECTIONS,
  validateWordData,
} from "./words";

describe("word data", () => {
  it("contains every word in ASSESSMENT_DESIGN.md (74 — see note in words.ts)", () => {
    // The source's flat list AND mapping table both contain 74 distinct words
    // and agree exactly; only the document's summary label says "73". We
    // transcribe the actual data. See the discrepancy note in words.ts.
    expect(WORDS).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const seen = new Set(WORDS.map((w) => w.word));
    expect(seen.size).toBe(WORDS.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const w of WORDS) {
      expect(w.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("only references tribe slugs that exist in the tribes source of truth", () => {
    const valid = new Set(tribes.map((t) => t.slug));
    for (const w of WORDS) {
      for (const slug of w.tribes) {
        expect(valid.has(slug)).toBe(true);
      }
    }
  });

  it("covers every one of the 12 tribes at least once", () => {
    const covered = new Set(WORDS.flatMap((w) => w.tribes));
    for (const t of tribes) {
      expect(covered.has(t.slug)).toBe(true);
    }
  });

  it("exposes selection constants (min 8, max 15)", () => {
    expect(MIN_SELECTIONS).toBe(8);
    expect(MAX_SELECTIONS).toBe(15);
  });
});

describe("validateWordData", () => {
  it("passes on the real word data without throwing", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a mapped slug does not resolve to a tribe", () => {
    expect(() =>
      validateWordData([{ word: "Bogus", tribes: ["not-a-tribe"] }]),
    ).toThrow(/not-a-tribe/);
  });
});
