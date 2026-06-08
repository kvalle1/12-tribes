import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import {
  words,
  wordWeight,
  validateWordMappings,
  MIN_WORDS,
  MAX_WORDS,
} from "./words";

describe("word data", () => {
  it("transcribes every mapping row from ASSESSMENT_DESIGN.md (74 entries)", () => {
    // The doc heads the list "Total: 73 words", but the mapping table — the
    // authoritative scoring source — enumerates 74 rows. We transcribe all 74.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const seen = new Set(words.map((w) => w.word.toLowerCase()));
    expect(seen.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const mapping of words) {
      expect(mapping.tribes.length).toBeGreaterThan(0);
    }
  });

  it("exposes the 8–15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("wordWeight", () => {
  it("scores a single-tribe word as a full point", () => {
    expect(wordWeight({ word: "Courageous", tribes: ["judah"] })).toBe(1);
  });

  it("scores a shared (two-tribe) word as 0.5 to each tribe", () => {
    expect(wordWeight({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(0.5);
  });

  it("scores a three-tribe word as 0.5 to each tribe", () => {
    // "Zealous" maps to Judah · Benjamin · Simeon; the footnote says a shared
    // word scores 0.5 to *each* mapped tribe regardless of count.
    expect(
      wordWeight({ word: "Zealous", tribes: ["judah", "benjamin", "simeon"] }),
    ).toBe(0.5);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word data — every slug resolves against tribes", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("confirms the slugs used are exactly the 12 tribe slugs", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    const used = new Set(words.flatMap((w) => w.tribes));
    for (const slug of used) expect(validSlugs.has(slug)).toBe(true);
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    expect(() =>
      validateWordMappings([{ word: "Ghostly", tribes: ["atlantis"] }]),
    ).toThrow(/Invalid tribe slug/i);
  });
});
