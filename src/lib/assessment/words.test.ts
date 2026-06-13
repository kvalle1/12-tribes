import { describe, expect, it } from "vitest";
import { getTribeBySlug } from "../tribes";
import {
  SELECTION_MAX,
  SELECTION_MIN,
  validateWordMappings,
  weightFor,
  wordList,
  words,
  type WordMapping,
} from "./words";

describe("word data", () => {
  // The Tribe Mapping + Word Coverage tables in ASSESSMENT_DESIGN.md list 74
  // words (including "Aggressive" -> Benjamin); only the prose flat list / its
  // "Total: 73" header omit it. We mirror the scoring tables — see words.ts.
  it("contains the full word list from the ASSESSMENT_DESIGN.md mapping table", () => {
    expect(words).toHaveLength(74);
    expect(wordList).toHaveLength(74);
  });

  it("includes Aggressive -> Benjamin (present in the scoring tables)", () => {
    const aggressive = words.find((w) => w.word === "Aggressive");
    expect(aggressive?.tribes).toEqual(["benjamin"]);
  });

  it("exposes the flat word list with no duplicates", () => {
    expect(new Set(wordList).size).toBe(74);
  });

  it("keeps the wordList in sync with the mappings", () => {
    expect(wordList).toEqual(words.map((w) => w.word));
  });

  it("defines the soft selection range as 8–15", () => {
    expect(SELECTION_MIN).toBe(8);
    expect(SELECTION_MAX).toBe(15);
  });

  it("transcribes Zealous as a three-tribe shared word", () => {
    const zealous = words.find((w) => w.word === "Zealous");
    expect(zealous?.tribes).toEqual(["judah", "benjamin", "simeon"]);
  });
});

describe("weightFor", () => {
  it("gives a sole-tribe word a full point", () => {
    expect(weightFor({ word: "Courageous", tribes: ["judah"] })).toBe(1);
  });

  it("gives a shared word 0.5 regardless of how many tribes it spans", () => {
    expect(weightFor({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(0.5);
    expect(
      weightFor({ word: "Zealous", tribes: ["judah", "benjamin", "simeon"] }),
    ).toBe(0.5);
  });
});

describe("validateWordMappings", () => {
  it("passes for the real word data (every slug resolves against tribes)", () => {
    expect(() => validateWordMappings()).not.toThrow();
    for (const mapping of words) {
      for (const slug of mapping.tribes) {
        expect(getTribeBySlug(slug)).toBeDefined();
      }
    }
  });

  it("fails loudly when a mapped slug does not exist in tribes", () => {
    const bad: WordMapping[] = [{ word: "Madeup", tribes: ["gryffindor"] }];
    expect(() => validateWordMappings(bad)).toThrow(/gryffindor/);
  });

  it("fails loudly when a word maps to no tribe at all", () => {
    const bad: WordMapping[] = [{ word: "Orphan", tribes: [] }];
    expect(() => validateWordMappings(bad)).toThrow(/Orphan/);
  });
});
