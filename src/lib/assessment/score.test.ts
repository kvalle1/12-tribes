import { describe, expect, it } from "vitest";
import {
  availablePoints,
  deriveResult,
  score,
  type AssessmentWord,
  type TribeScore,
} from "./score";
import { assessmentWords } from "./words";

// Small, controlled fixtures keep the scoring assertions exact and independent
// of the real 73-word data (which can be retuned without breaking these specs).
const fixture: AssessmentWord[] = [
  { word: "solo_a", tribes: ["a"] },
  { word: "shared_ab", tribes: ["a", "b"] },
  { word: "solo_b", tribes: ["b"] },
];

function scoreOf(scores: TribeScore[], slug: string): number {
  return scores.find((s) => s.slug === slug)?.score ?? 0;
}

describe("availablePoints", () => {
  it("counts a solo word as 1 and a shared word as 0.5 per tribe", () => {
    const totals = availablePoints(fixture);
    // a: solo_a (1) + shared_ab (0.5) = 1.5 ; b: shared_ab (0.5) + solo_b (1) = 1.5
    expect(totals.get("a")).toBe(1.5);
    expect(totals.get("b")).toBe(1.5);
  });
});

describe("score — shared-word 0.5 split", () => {
  it("gives a shared word 0.5 to each of its tribes", () => {
    // Selecting solo_a (1 to a) + shared_ab (0.5 to a, 0.5 to b).
    const scores = score(["solo_a", "shared_ab"], fixture);
    // a earned 1.5 of 1.5 available → 1.0 ; b earned 0.5 of 1.5 → 1/3.
    expect(scoreOf(scores, "a")).toBeCloseTo(1);
    expect(scoreOf(scores, "b")).toBeCloseTo(1 / 3);
  });

  it("splits a shared word evenly when picked alone", () => {
    const scores = score(["shared_ab"], fixture);
    expect(scoreOf(scores, "a")).toBeCloseTo(0.5 / 1.5);
    expect(scoreOf(scores, "b")).toBeCloseTo(0.5 / 1.5);
  });
});

describe("score — coverage-fair normalization", () => {
  // Tribe x has 2 words, tribe y has 4 words: uneven coverage.
  const coverage: AssessmentWord[] = [
    { word: "x1", tribes: ["x"] },
    { word: "x2", tribes: ["x"] },
    { word: "y1", tribes: ["y"] },
    { word: "y2", tribes: ["y"] },
    { word: "y3", tribes: ["y"] },
    { word: "y4", tribes: ["y"] },
  ];

  it("lets a 2-word tribe and a 4-word tribe both reach 1.0", () => {
    const scores = score(["x1", "x2", "y1", "y2", "y3", "y4"], coverage);
    expect(scoreOf(scores, "x")).toBeCloseTo(1);
    expect(scoreOf(scores, "y")).toBeCloseTo(1);
  });

  it("normalizes by each tribe's own available points", () => {
    // Half of each tribe's words → both 0.5, despite different absolute counts.
    const scores = score(["x1", "y1", "y2"], coverage);
    expect(scoreOf(scores, "x")).toBeCloseTo(0.5);
    expect(scoreOf(scores, "y")).toBeCloseTo(0.5);
  });

  it("returns a score for every tribe in the list, ranked highest-first", () => {
    const scores = score(["x1", "x2"], coverage);
    expect(scores.map((s) => s.slug)).toEqual(["x", "y"]);
    expect(scores[0].score).toBeGreaterThanOrEqual(scores[1].score);
  });

  it("ignores unknown words and duplicate selections", () => {
    const once = score(["x1"], coverage);
    const dupedPlusJunk = score(["x1", "x1", "not-a-word"], coverage);
    expect(dupedPlusJunk).toEqual(once);
  });
});

describe("deriveResult", () => {
  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult([
      { slug: "a", score: 0.4 },
      { slug: "b", score: 0.9 },
      { slug: "c", score: 0.1 },
    ]);
    expect(result.primary.slug).toBe("b");
  });

  it("ranks before choosing, regardless of input order", () => {
    const result = deriveResult([
      { slug: "c", score: 0.1 },
      { slug: "a", score: 0.4 },
      { slug: "b", score: 0.9 },
    ]);
    expect(result.primary.slug).toBe("b");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult([
      { slug: "a", score: 1.0 },
      { slug: "b", score: 0.9 },
      { slug: "c", score: 0.3 },
    ]);
    expect(result.primary.slug).toBe("a");
    expect(result.secondary?.slug).toBe("b");
  });

  it("hides the Secondary when it is far behind Primary", () => {
    const result = deriveResult([
      { slug: "a", score: 1.0 },
      { slug: "b", score: 0.5 }, // 50% behind → outside 20% proximity
      { slug: "c", score: 0.1 },
    ]);
    expect(result.primary.slug).toBe("a");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      { slug: "a", score: 1.0 },
      { slug: "b", score: 0.9 }, // near primary…
      { slug: "c", score: 0.85 }, // …but the third is right behind it
    ]);
    expect(result.primary.slug).toBe("a");
    expect(result.secondary).toBeUndefined();
  });

  it("names only a Primary when no other tribe scored", () => {
    const result = deriveResult([
      { slug: "a", score: 0.7 },
      { slug: "b", score: 0 },
    ]);
    expect(result.primary.slug).toBe("a");
    expect(result.secondary).toBeUndefined();
  });

  it("respects tunable thresholds", () => {
    const scores = [
      { slug: "a", score: 1.0 },
      { slug: "b", score: 0.7 },
      { slug: "c", score: 0.1 },
    ];
    // Default 20% proximity hides b (30% behind)…
    expect(deriveResult(scores).secondary).toBeUndefined();
    // …a looser 40% proximity surfaces it.
    expect(deriveResult(scores, { secondaryProximity: 0.4 }).secondary?.slug).toBe("b");
  });
});

describe("score — real assessment data", () => {
  it("returns a normalized [0,1] score for all 12 tribes", () => {
    const scores = score(["Authoritative", "Courageous", "Honorable"], assessmentWords);
    expect(scores).toHaveLength(12);
    for (const { score: s } of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("ranks Judah first for unambiguously Judah words", () => {
    const scores = score(["Authoritative", "Courageous", "Honorable", "Sacrificial"], assessmentWords);
    expect(scores[0].slug).toBe("judah");
    expect(deriveResult(scores).primary.slug).toBe("judah");
  });
});
