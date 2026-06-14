import { describe, expect, it } from "vitest";
import { getTribeBySlug } from "@/lib/tribes";
import {
  MAX_WORDS,
  MIN_WORDS,
  SHARED_WORD_WEIGHT,
  SOLO_WORD_WEIGHT,
  perTribeWeight,
  validateWordMappings,
  validateWords,
  words,
} from "@/lib/assessment/words";

describe("word data", () => {
  // ASSESSMENT_DESIGN.md labels the list "Total: 73 words", but both the flat
  // list and the mapping table enumerate 74 unique words (verified identical).
  // We transcribe the doc's actual content faithfully; the "73" header is a
  // miscount in the source and is flagged for the maintainer to reconcile.
  it("contains exactly 74 words (every row in the mapping table)", () => {
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const unique = new Set(words.map((w) => w.word));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const mapping of words) {
      expect(mapping.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("exposes the 8–15 selection constraint", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("perTribeWeight", () => {
  it("gives a solo word the full weight", () => {
    expect(perTribeWeight({ word: "Authoritative", tribes: ["judah"] })).toBe(
      SOLO_WORD_WEIGHT,
    );
  });

  it("gives a shared word half weight per tribe", () => {
    expect(
      perTribeWeight({ word: "Bold", tribes: ["judah", "reuben"] }),
    ).toBe(SHARED_WORD_WEIGHT);
  });

  it("gives a three-tribe word half weight per tribe", () => {
    expect(
      perTribeWeight({
        word: "Zealous",
        tribes: ["judah", "benjamin", "simeon"],
      }),
    ).toBe(SHARED_WORD_WEIGHT);
  });
});

describe("validation", () => {
  it("passes for the real word data (all slugs resolve)", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("confirms every mapped slug resolves against the tribes source of truth", () => {
    for (const mapping of words) {
      for (const slug of mapping.tribes) {
        expect(getTribeBySlug(slug)).toBeDefined();
      }
    }
  });

  it("fails loudly when a mapped slug does not exist", () => {
    expect(() =>
      validateWordMappings([{ word: "Bogus", tribes: ["nonexistent"] }]),
    ).toThrow(/unknown tribe slug/i);
  });

  it("names the offending word and slug in the error", () => {
    expect(() =>
      validateWordMappings([{ word: "Bogus", tribes: ["nope"] }]),
    ).toThrow(/Bogus → nope/);
  });
});
