import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  validateWordData,
  MIN_SELECTED_WORDS,
  MAX_SELECTED_WORDS,
} from "./words";

describe("word data", () => {
  it("contains every word from the ASSESSMENT_DESIGN.md mapping table", () => {
    // The mapping table and flat list both contain 74 entries (the document's
    // prose "Total: 73 words" label undercounts by one). We transcribe the
    // table faithfully rather than the inaccurate label.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const seen = new Set(words.map((w) => w.word));
    expect(seen.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes the selection bounds (min 8, max 15)", () => {
    expect(MIN_SELECTED_WORDS).toBe(8);
    expect(MAX_SELECTED_WORDS).toBe(15);
  });

  it("covers all 12 tribes at least once", () => {
    const mapped = new Set(words.flatMap((w) => w.tribes));
    for (const t of tribes) {
      expect(mapped.has(t.slug)).toBe(true);
    }
  });
});

describe("validateWordData", () => {
  it("passes for the real word data (every slug resolves against tribes)", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    expect(() =>
      validateWordData([{ word: "Phantom", tribes: ["nonexistent"] }]),
    ).toThrow(/nonexistent/);
  });

  it("fails loudly when a word maps to no tribe at all", () => {
    expect(() => validateWordData([{ word: "Empty", tribes: [] }])).toThrow();
  });
});
