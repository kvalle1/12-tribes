import { describe, it, expect } from "vitest";
import { getTribeBySlug } from "@/lib/tribes";
import {
  words,
  validateWordData,
  MIN_WORDS,
  MAX_WORDS,
  type WordMapping,
} from "./words";

/**
 * The flat word list exactly as it appears under "## The Word List" in
 * ASSESSMENT_DESIGN.md. Kept independently from the mapping so the two can be
 * cross-checked: the mapping must cover precisely this set of words.
 */
const DESIGN_DOC_WORDS = [
  "Aggressive", "Alert", "Analytical", "Authoritative", "Battle-tested",
  "Bold", "Cautious", "Comforting", "Consistent", "Convicted", "Courageous",
  "Creative", "Cunning", "Decisive", "Dedicated", "Deliberate", "Devoted",
  "Discerning", "Driven", "Enduring", "Energetic", "Enriching", "Enterprising",
  "Exacting", "Expansive", "Expressive", "Faithful", "Fervent", "Fierce",
  "Free-spirited", "Generous", "Graceful", "Gritty", "Guarding", "Healing",
  "Honorable", "Hospitable", "Impulsive", "Insightful", "Inspiring", "Intense",
  "Just", "Learned", "Loyal", "Measured", "Nurturing", "Observant", "Organized",
  "Passionate", "Patient", "Peaceful", "Perceptive", "Precise", "Prosperous",
  "Protective", "Reliable", "Resilient", "Resourceful", "Reverent", "Righteous",
  "Sacrificial", "Skeptical", "Steady", "Strategic", "Strong", "Supportive",
  "Territorial", "Tough", "Uncompromising", "Vigilant", "Watchful", "Welcoming",
  "Wise", "Zealous",
];

describe("word data", () => {
  it("matches the flat word list in ASSESSMENT_DESIGN.md exactly", () => {
    const listed = words.map((w) => w.word);
    // The design doc's flat list and mapping table both contain 74 words
    // (the doc's "Total: 73" header is a known miscount).
    expect(new Set(listed)).toEqual(new Set(DESIGN_DOC_WORDS));
    expect(listed).toHaveLength(DESIGN_DOC_WORDS.length);
  });

  it("has no duplicate words", () => {
    const listed = words.map((w) => w.word);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("maps every word to at least one tribe", () => {
    for (const entry of words) {
      expect(entry.tribes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("only references tribe slugs that exist in the tribes source of truth", () => {
    for (const entry of words) {
      for (const slug of entry.tribes) {
        expect(getTribeBySlug(slug), `slug "${slug}"`).toBeDefined();
      }
    }
  });

  it("exposes selection constants from the design doc", () => {
    expect(MIN_WORDS).toBe(8);
    expect(MAX_WORDS).toBe(15);
  });
});

describe("validateWordData", () => {
  it("passes for the real word data", () => {
    expect(() => validateWordData()).not.toThrow();
  });

  it("throws loudly when a mapped slug does not exist in tribes", () => {
    const broken: WordMapping[] = [{ word: "Bogus", tribes: ["nonexistent"] }];
    expect(() => validateWordData(broken)).toThrow(/unknown tribe slug/i);
  });

  it("throws when a word maps to no tribe", () => {
    const broken: WordMapping[] = [{ word: "Empty", tribes: [] }];
    expect(() => validateWordData(broken)).toThrow(/not mapped to any tribe/i);
  });

  it("throws on duplicate words", () => {
    const broken: WordMapping[] = [
      { word: "Bold", tribes: ["judah"] },
      { word: "Bold", tribes: ["reuben"] },
    ];
    expect(() => validateWordData(broken)).toThrow(/duplicate/i);
  });
});
