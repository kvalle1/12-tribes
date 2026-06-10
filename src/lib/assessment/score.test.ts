import { describe, it, expect } from "vitest";
import { score, deriveResult, type TribeScore } from "./score";
import type { WordMapping } from "./words";

// Tiny synthetic catalogs (using real tribe slugs) let us assert exact math
// independent of the full 73-word data.
const sharedCatalog: WordMapping[] = [
  { word: "S", tribes: ["judah", "reuben"] }, // Shared
  { word: "J", tribes: ["judah"] },
  { word: "R", tribes: ["reuben"] },
];

const coverageCatalog: WordMapping[] = [
  { word: "A", tribes: ["levi"] }, // levi: 2 words available
  { word: "B", tribes: ["levi"] },
  { word: "C", tribes: ["judah"] }, // judah: 4 words available
  { word: "D", tribes: ["judah"] },
  { word: "E", tribes: ["judah"] },
  { word: "F", tribes: ["judah"] },
];

function scoreOf(scores: TribeScore[], slug: string): number {
  return scores.find((s) => s.slug === slug)!.score;
}

describe("score() — shared words", () => {
  it("splits a Shared word 0.5 to each of its two tribes", () => {
    const scores = score(["S"], sharedCatalog);
    // Each tribe has 1.5 points available (0.5 from S + 1 from its own word).
    // Selecting only S earns each 0.5 → normalized 0.5 / 1.5.
    expect(scoreOf(scores, "judah")).toBeCloseTo(0.5 / 1.5);
    expect(scoreOf(scores, "reuben")).toBeCloseTo(0.5 / 1.5);
  });

  it("an exclusive word contributes a full point to its one tribe", () => {
    const scores = score(["J"], sharedCatalog);
    expect(scoreOf(scores, "judah")).toBeCloseTo(1 / 1.5);
    expect(scoreOf(scores, "reuben")).toBe(0);
  });
});

describe("score() — coverage-fair normalization", () => {
  it("a small tribe and a large tribe both reach 1.0 at full coverage", () => {
    expect(scoreOf(score(["A", "B"], coverageCatalog), "levi")).toBe(1);
    expect(
      scoreOf(score(["C", "D", "E", "F"], coverageCatalog), "judah"),
    ).toBe(1);
  });

  it("equal fractions score equally despite unequal word counts", () => {
    // 1 of levi's 2 words == 2 of judah's 4 words == 0.5
    expect(scoreOf(score(["A"], coverageCatalog), "levi")).toBe(0.5);
    expect(scoreOf(score(["C", "D"], coverageCatalog), "judah")).toBe(0.5);
  });

  it("returns a score for every tribe, ranked highest-first", () => {
    const scores = score(["A"], coverageCatalog);
    expect(scores).toHaveLength(12);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });

  it("ignores words not in the catalog and de-duplicates selections", () => {
    expect(scoreOf(score(["A", "A", "unknown"], coverageCatalog), "levi")).toBe(
      0.5,
    );
  });
});

describe("score() — real data", () => {
  it("scores a real Shared word into exactly its two tribes", () => {
    const scores = score(["Bold"]); // Bold → judah · reuben
    expect(scoreOf(scores, "judah")).toBeGreaterThan(0);
    expect(scoreOf(scores, "reuben")).toBeGreaterThan(0);
    const others = scores.filter(
      (s) => s.slug !== "judah" && s.slug !== "reuben",
    );
    expect(others.every((s) => s.score === 0)).toBe(true);
  });
});

// Build a ranked score list from [primary, secondary, third, ...rest] values.
function ranked(values: number[]): TribeScore[] {
  return tribesSlugs.map((slug, i) => ({ slug, score: values[i] ?? 0 }));
}
const tribesSlugs = [
  "judah",
  "levi",
  "issachar",
  "zebulun",
  "joseph",
  "benjamin",
  "dan",
  "naphtali",
  "asher",
  "gad",
  "reuben",
  "simeon",
];

describe("deriveResult()", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult(ranked([0.4, 1.0, 0.2]));
    expect(result.primary.slug).toBe("levi");
    expect(result.primary.score).toBe(1.0);
  });

  it("shows a Secondary when it is near Primary and clearly ahead of third", () => {
    const result = deriveResult(ranked([1.0, 0.9, 0.5]));
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(ranked([1.0, 0.5, 0.4]));
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(ranked([1.0, 0.85, 0.8]));
    expect(result.secondary).toBeUndefined();
  });

  it("throws when given no scores", () => {
    expect(() => deriveResult([])).toThrow();
  });
});

// Type re-export sanity: the public WordMapping type is usable by callers.
const _typecheck: WordMapping = { word: "x", tribes: ["judah"] };
void _typecheck;
