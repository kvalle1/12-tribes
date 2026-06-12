import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  words,
  MIN_WORDS,
  MAX_WORDS,
  wordWeight,
  validateWordMappings,
  type WordMapping,
} from "./words";

describe("word data", () => {
  it("transcribes the full ASSESSMENT_DESIGN word list (74 entries)", () => {
    // NOTE: the design doc's summary line says "Total: 73 words", but both the
    // flat list and the mapping table it is scored from contain 74 entries.
    // The table is the scoring source of truth, so we transcribe all 74.
    expect(words).toHaveLength(74);
  });

  it("has no duplicate words", () => {
    const seen = new Set(words.map((w) => w.word.toLowerCase()));
    expect(seen.size).toBe(words.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const w of words) {
      expect(w.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("references only slugs that exist in the tribes source of truth", () => {
    const slugs = new Set(tribes.map((t) => t.slug));
    for (const w of words) {
      for (const slug of w.tribes) {
        expect(slugs, `word "${w.word}" -> "${slug}"`).toContain(slug);
      }
    }
  });

  it("exposes the 8-15 selection constants", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("weights a solo word 1.0 and a shared word 0.5", () => {
    const solo: WordMapping = { word: "Aggressive", tribes: ["benjamin"] };
    const shared: WordMapping = { word: "Bold", tribes: ["judah", "reuben"] };
    const triple: WordMapping = {
      word: "Zealous",
      tribes: ["judah", "benjamin", "simeon"],
    };
    expect(wordWeight(solo)).toBe(1);
    expect(wordWeight(shared)).toBe(0.5);
    // the doc legend: "* = shared word, scores 0.5 to each mapped tribe" — so
    // the three-tribe word Zealous also contributes 0.5 to each.
    expect(wordWeight(triple)).toBe(0.5);
  });

  it("contains the known shared and solo words from the design doc", () => {
    const bold = words.find((w) => w.word === "Bold");
    expect(bold?.tribes).toEqual(["judah", "reuben"]);
    const zealous = words.find((w) => w.word === "Zealous");
    expect(zealous?.tribes).toEqual(["judah", "benjamin", "simeon"]);
    const aggressive = words.find((w) => w.word === "Aggressive");
    expect(aggressive?.tribes).toEqual(["benjamin"]);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word data", () => {
    expect(() => validateWordMappings()).not.toThrow();
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    const bad: WordMapping[] = [{ word: "Nonsense", tribes: ["atlantis"] }];
    expect(() => validateWordMappings(bad)).toThrow(/atlantis/);
  });
});
