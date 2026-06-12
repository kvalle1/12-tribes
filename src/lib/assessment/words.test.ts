import { describe, it, expect } from "vitest";
import { getTribeBySlug } from "../tribes";
import {
  words,
  weightFor,
  validateWordData,
  validateWordEntries,
  SELECTION_MIN,
  SELECTION_MAX,
} from "./words";

describe("word data", () => {
  it("transcribes the full ASSESSMENT_DESIGN mapping table", () => {
    // The mapping table enumerates 74 distinct adjective rows.
    expect(words).toHaveLength(74);
    const unique = new Set(words.map((w) => w.word.toLowerCase()));
    expect(unique.size).toBe(words.length);
  });

  it("maps every word to at least one real tribe slug", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThan(0);
      for (const slug of entry.tribes) {
        expect(getTribeBySlug(slug)).toBeDefined();
      }
    }
  });

  it("preserves the documented multi-tribe mappings", () => {
    const find = (w: string) => words.find((e) => e.word === w);
    expect(find("Bold")?.tribes).toEqual(["judah", "reuben"]);
    // "Zealous" is the lone three-tribe word in the source table.
    expect(find("Zealous")?.tribes).toEqual(["judah", "benjamin", "simeon"]);
  });

  it("exposes the 8–15 selection range", () => {
    expect(SELECTION_MIN).toBe(8);
    expect(SELECTION_MAX).toBe(15);
  });
});

describe("weightFor", () => {
  it("gives an exclusive word a full point", () => {
    expect(weightFor({ word: "Authoritative", tribes: ["judah"] })).toBe(1);
  });

  it("gives a shared word 0.5 to each of its tribes — including a three-tribe word", () => {
    expect(weightFor({ word: "Bold", tribes: ["judah", "reuben"] })).toBe(0.5);
    expect(
      weightFor({ word: "Zealous", tribes: ["judah", "benjamin", "simeon"] }),
    ).toBe(0.5);
  });
});

describe("validateWordData", () => {
  it("accepts the real word list", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("fails loudly when a word references an unknown tribe slug", () => {
    expect(() =>
      validateWordEntries([{ word: "Made-up", tribes: ["atlantis"] }]),
    ).toThrow(/atlantis/);
  });

  it("fails loudly on a duplicate word", () => {
    expect(() =>
      validateWordEntries([
        { word: "Bold", tribes: ["judah"] },
        { word: "bold", tribes: ["reuben"] },
      ]),
    ).toThrow(/Duplicate/);
  });
});
