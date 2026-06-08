import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "@/lib/assessment/words";
import {
  score,
  deriveResult,
  SECONDARY_NEAR_PRIMARY,
  SECONDARY_AHEAD_OF_THIRD,
  type TribeScore,
} from "@/lib/assessment/score";

/** Convenience: pull a tribe's normalized score out of a score() result. */
function scoreFor(result: TribeScore[], slug: string): number {
  return result.find((s) => s.slug === slug)!.score;
}

describe("score()", () => {
  it("returns a normalized 0–1 value for every one of the 12 tribes", () => {
    const result = score(["Bold", "Courageous", "Wise"]);
    expect(result).toHaveLength(tribes.length);
    for (const { score: value } of result) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("is sorted by score descending", () => {
    const result = score(["Bold", "Courageous", "Honorable", "Wise"]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("splits a shared word 0.5 to each of its two tribes", () => {
    // "Courageous" is solo-Judah (weight 1); "Bold" is Judah·Reuben (0.5 each).
    // Normalization shares the same Judah denominator, so the shared word must
    // contribute exactly half of what the solo word does to Judah.
    const solo = scoreFor(score(["Courageous"]), "judah");
    const shared = scoreFor(score(["Bold"]), "judah");
    expect(shared).toBeCloseTo(solo / 2);

    // And the other half lands on Reuben.
    const both = score(["Bold"]);
    expect(scoreFor(both, "judah")).toBeGreaterThan(0);
    expect(scoreFor(both, "reuben")).toBeGreaterThan(0);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi (6 words) and Dan (10 words) have very different coverage. Selecting
    // every word that maps to a tribe should max that tribe at 1.0 regardless
    // of how many words it has — a fair, comparable score.
    const leviWords = words
      .filter((w) => w.tribeSlugs.includes("levi"))
      .map((w) => w.word);
    const danWords = words
      .filter((w) => w.tribeSlugs.includes("dan"))
      .map((w) => w.word);

    expect(leviWords.length).toBeLessThan(danWords.length); // differing coverage
    expect(scoreFor(score(leviWords), "levi")).toBeCloseTo(1);
    expect(scoreFor(score(danWords), "dan")).toBeCloseTo(1);
  });

  it("ignores unknown words", () => {
    const result = score(["NotAWord", "AlsoFake"]);
    expect(result.every((s) => s.score === 0)).toBe(true);
  });
});

describe("deriveResult()", () => {
  const makeScores = (entries: Array<[string, number]>): TribeScore[] =>
    entries.map(([slug, value]) => ({ slug, score: value }));

  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult(
      makeScores([
        ["judah", 0.3],
        ["levi", 0.9],
        ["dan", 0.1],
      ]),
    );
    expect(result.primary).toBe("levi");
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      makeScores([
        ["judah", 1.0],
        ["benjamin", 0.9], // ≥ 0.8 * primary, and ≥ 1.25x the third
        ["dan", 0.5], // ≤ 0.8 * secondary
        ["levi", 0.2],
      ]),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      makeScores([
        ["judah", 1.0],
        ["benjamin", 0.5], // < 0.8 * primary
        ["dan", 0.1],
      ]),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is roughly tied with the third tribe", () => {
    const result = deriveResult(
      makeScores([
        ["judah", 1.0],
        ["benjamin", 0.9], // near the primary...
        ["dan", 0.88], // ...but the third is essentially tied with it
        ["levi", 0.2],
      ]),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("names only a Primary when no words were selected (all zero)", () => {
    const result = deriveResult(tribes.map((t) => ({ slug: t.slug, score: 0 })));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("composes with score() end-to-end", () => {
    const result = deriveResult(score(["Courageous", "Honorable", "Authoritative"]));
    expect(result.primary).toBe("judah");
  });

  it("exposes tunable thresholds", () => {
    expect(SECONDARY_NEAR_PRIMARY).toBeGreaterThan(0);
    expect(SECONDARY_NEAR_PRIMARY).toBeLessThanOrEqual(1);
    expect(SECONDARY_AHEAD_OF_THIRD).toBeGreaterThan(0);
    expect(SECONDARY_AHEAD_OF_THIRD).toBeLessThanOrEqual(1);
  });
});
