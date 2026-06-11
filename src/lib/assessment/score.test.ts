import { describe, expect, it } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import { deriveResult, score, type TribeScore } from "./score";

const scoreFor = (scores: TribeScore[], slug: string): number =>
  scores.find((s) => s.slug === slug)!.score;

const wordsForTribe = (slug: string): string[] =>
  words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const mk = (slug: string, score: number): TribeScore => ({
  slug,
  name: slug,
  score,
});

describe("score", () => {
  it("returns a normalized score for all 12 tribes in [0, 1]", () => {
    const scores = score(["Courageous", "Honorable", "Wise"]);
    expect(scores).toHaveLength(12);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives an exclusive word full weight and a shared word half — 0.5 to each tribe", () => {
    // "Courageous" is Judah-only (weight 1.0); "Bold" is Judah+Reuben (0.5 each).
    const exclusive = score(["Courageous"]);
    const shared = score(["Bold"]);

    // Same Judah denominator, so the shared word earns Judah exactly half.
    expect(scoreFor(shared, "judah")).toBeCloseTo(
      scoreFor(exclusive, "judah") / 2,
    );
    // And the other half lands on Reuben.
    expect(scoreFor(shared, "reuben")).toBeGreaterThan(0);
  });

  it("normalizes by each tribe's available points, so coverage size doesn't bias the result", () => {
    // Selecting every word that maps to a tribe should max it out at 1.0,
    // whether the tribe has few words or many — they compete fairly.
    for (const tribe of tribes) {
      const scores = score(wordsForTribe(tribe.slug));
      expect(scoreFor(scores, tribe.slug)).toBeCloseTo(1);
    }
  });

  it("ignores unknown words", () => {
    const baseline = score(["Courageous"]);
    const withNoise = score(["Courageous", "Flibbertigibbet"]);
    expect(withNoise).toEqual(baseline);
  });

  it("scores an empty selection as all zeros", () => {
    for (const s of score([])) {
      expect(s.score).toBe(0);
    }
  });
});

describe("deriveResult", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult([mk("dan", 0.4), mk("gad", 0.1)]);
    expect(result.primary.slug).toBe("dan");
  });

  it("picks the Primary regardless of input ordering", () => {
    const result = deriveResult([
      mk("gad", 0.1),
      mk("judah", 0.9),
      mk("levi", 0.5),
    ]);
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult([
      mk("judah", 0.9),
      mk("benjamin", 0.8),
      mk("dan", 0.3),
    ]);
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      mk("judah", 0.9),
      mk("benjamin", 0.5), // below 0.9 * 0.8 = 0.72
      mk("dan", 0.3),
    ]);
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is roughly tied with the third tribe", () => {
    const result = deriveResult([
      mk("judah", 0.9),
      mk("benjamin", 0.8),
      mk("dan", 0.78), // above 0.8 * 0.8 = 0.64, so not clearly behind
    ]);
    expect(result.secondary).toBeUndefined();
  });

  it("does not name a Secondary that scored zero", () => {
    const result = deriveResult([mk("judah", 0), mk("benjamin", 0)]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });
});
