import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  score,
  deriveResult,
  type TribeScore,
} from "@/lib/assessment/score";

/** Find a tribe's score in the result array. */
const scoreOf = (scores: TribeScore[], slug: string) =>
  scores.find((s) => s.slug === slug)!.score;

// Available points per tribe (sum of word weights; sole word = 1, shared = 0.5),
// derived from the mapping table. Used to assert exact normalized values.
const ISSACHAR_AVAILABLE = 8.5;
const DAN_AVAILABLE = 8.0;
const REUBEN_AVAILABLE = 4.5;

describe("score", () => {
  it("returns a normalized 0–1 score for all 12 tribes", () => {
    const scores = score(["Analytical", "Bold", "Cautious"]);
    expect(scores).toHaveLength(tribes.length);
    for (const { score: s } of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("returns the scores sorted by descending score", () => {
    const scores = score(["Authoritative", "Courageous", "Analytical"]);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });

  it("a shared word contributes 0.5 to each of its two tribes", () => {
    // "Cautious" is shared between dan and issachar.
    const scores = score(["Cautious"]);
    expect(scoreOf(scores, "issachar")).toBeCloseTo(0.5 / ISSACHAR_AVAILABLE);
    expect(scoreOf(scores, "dan")).toBeCloseTo(0.5 / DAN_AVAILABLE);
  });

  it("a shared word gives a tribe exactly half of what a sole word gives", () => {
    // "Analytical" is issachar-only (weight 1); "Cautious" is shared (weight 0.5).
    const sole = scoreOf(score(["Analytical"]), "issachar");
    const shared = scoreOf(score(["Cautious"]), "issachar");
    expect(shared).toBeCloseTo(sole / 2);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Both words earn 1 raw point, but reuben has fewer available points than
    // issachar, so the same raw point yields a higher normalized score.
    const scores = score(["Energetic", "Analytical"]);
    expect(scoreOf(scores, "reuben")).toBeCloseTo(1 / REUBEN_AVAILABLE);
    expect(scoreOf(scores, "issachar")).toBeCloseTo(1 / ISSACHAR_AVAILABLE);
    expect(scoreOf(scores, "reuben")).toBeGreaterThan(scoreOf(scores, "issachar"));
  });

  it("reaches exactly 1.0 when all of a tribe's words are selected", () => {
    const issacharWords = [
      "Analytical", "Cautious", "Discerning", "Insightful", "Learned",
      "Measured", "Observant", "Patient", "Perceptive", "Strategic", "Wise",
    ];
    expect(scoreOf(score(issacharWords), "issachar")).toBeCloseTo(1);
  });

  it("ignores words not on the list", () => {
    expect(score(["Analytical", "Nonexistent"])).toEqual(score(["Analytical"]));
  });

  it("is case-insensitive on the selected words", () => {
    expect(score(["analytical"])).toEqual(score(["Analytical"]));
  });
});

describe("deriveResult", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult(score(["Authoritative", "Courageous", "Honorable"]));
    expect(result.primary).toBe("judah");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of third", () => {
    const scores: TribeScore[] = [
      { slug: "judah", score: 1.0 },
      { slug: "benjamin", score: 0.9 },
      { slug: "dan", score: 0.5 },
    ];
    const result = deriveResult(scores);
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const scores: TribeScore[] = [
      { slug: "judah", score: 1.0 },
      { slug: "benjamin", score: 0.6 }, // < 80% of primary
      { slug: "dan", score: 0.3 },
    ];
    expect(deriveResult(scores).secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const scores: TribeScore[] = [
      { slug: "judah", score: 1.0 },
      { slug: "benjamin", score: 0.9 }, // near primary...
      { slug: "dan", score: 0.85 },     // ...but third is right behind it
    ];
    expect(deriveResult(scores).secondary).toBeUndefined();
  });

  it("hides the Secondary when there is no real signal beyond the Primary", () => {
    const result = deriveResult(score(["Authoritative", "Courageous"]));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("throws on empty input", () => {
    expect(() => deriveResult([])).toThrow();
  });
});
