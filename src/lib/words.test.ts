import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { tribes } from "./tribes";
import { MAX_WORDS, MIN_WORDS, validateWords, words } from "./words";

/** Parse the "Tribe Mapping" table out of ASSESSMENT_DESIGN.md → word → sorted slugs. */
function parseDesignMapping(): Map<string, string[]> {
  const md = readFileSync(
    join(process.cwd(), "ASSESSMENT_DESIGN.md"),
    "utf8",
  );
  const section = md.split("## Tribe Mapping")[1].split("## Word Coverage")[0];
  const mapping = new Map<string, string[]>();
  for (const line of section.split("\n")) {
    const m = line.match(/^\|\s*([A-Za-z][\w -]*?)\s*\|\s*([^|]+?)\s*\|$/);
    if (!m) continue;
    const [, word, tribeCell] = m;
    if (word === "Word") continue; // header row
    const slugs = tribeCell
      .split("·")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .sort();
    mapping.set(word, slugs);
  }
  return mapping;
}

describe("word data", () => {
  it("transcribes the ASSESSMENT_DESIGN.md mapping table exactly", () => {
    const design = parseDesignMapping();
    const data = new Map(
      words.map((w) => [w.word, [...w.tribes].sort()] as const),
    );

    expect(data.size).toBe(design.size);
    for (const [word, slugs] of design) {
      expect(data.get(word), `missing word: ${word}`).toEqual(slugs);
    }
  });

  it("exposes selection constants (min 8, max 15)", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });

  it("has no duplicate words", () => {
    expect(new Set(words.map((w) => w.word)).size).toBe(words.length);
  });
});

describe("validateWords", () => {
  it("passes for the real word data", () => {
    expect(() => validateWords()).not.toThrow();
  });

  it("confirms every mapped slug resolves to a real tribe", () => {
    const validSlugs = new Set(tribes.map((t) => t.slug));
    for (const w of words) {
      for (const slug of w.tribes) {
        expect(validSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("fails loudly when a word maps to an unknown tribe slug", () => {
    expect(() =>
      validateWords([{ word: "Bogus", tribes: ["not-a-tribe"] }]),
    ).toThrow(/unknown tribe slug/);
  });

  it("fails loudly when a word maps to no tribes", () => {
    expect(() => validateWords([{ word: "Bogus", tribes: [] }])).toThrow(
      /no tribes/,
    );
  });
});
