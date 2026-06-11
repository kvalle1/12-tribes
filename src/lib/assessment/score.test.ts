import { describe, expect, it } from "vitest";
import { WORD_MAPPINGS } from "./words";
import {
  availablePoints,
  deriveResult,
  rawPoints,
  score,
  type TribeScore,
} from "./score";

/** All words that map to a given tribe slug (data-driven, not hand-listed). */
function wordsForTribe(slug: string): string[] {
  return WORD_MAPPINGS.filter((m) => m.tribes.includes(slug)).map((m) => m.word);
}

describe("rawPoints — per-word point splitting", () => {
  it("gives a single-tribe word its full point", () => {
    expect(rawPoints(["Aggressive"]).benjamin).toBeCloseTo(1);
  });

  it("splits a shared word 0.5 to each of its two tribes", () => {
    const points = rawPoints(["Bold"]); // Judah · Reuben
    expect(points.judah).toBeCloseTo(0.5);
    expect(points.reuben).toBeCloseTo(0.5);
  });

  it("splits the three-tribe word evenly (1/3 each)", () => {
    const points = rawPoints(["Zealous"]); // Judah · Benjamin · Simeon
    expect(points.judah).toBeCloseTo(1 / 3);
    expect(points.benjamin).toBeCloseTo(1 / 3);
    expect(points.simeon).toBeCloseTo(1 / 3);
  });

  it("ignores unknown words", () => {
    expect(rawPoints(["NotAWord"]).judah).toBe(0);
  });
});

describe("score — normalization", () => {
  it("returns a 0–1 value for every one of the 12 tribes", () => {
    const scores = score(["Bold", "Wise", "Just"]);
    expect(scores).toHaveLength(12);
    for (const { slug, score: s } of scores) {
      expect(s, slug).toBeGreaterThanOrEqual(0);
      expect(s, slug).toBeLessThanOrEqual(1);
    }
  });

  it("normalizes a shared word's 0.5 by the tribe's available points", () => {
    const available = availablePoints();
    const bySlug = Object.fromEntries(score(["Bold"]).map((s) => [s.slug, s.score]));
    expect(bySlug.judah).toBeCloseTo(0.5 / available.judah);
    expect(bySlug.reuben).toBeCloseTo(0.5 / available.reuben);
  });

  it("lets a small-coverage and a large-coverage tribe both reach 1.0 (fair)", () => {
    const small = wordsForTribe("levi"); // 6 words
    const large = wordsForTribe("issachar"); // 11 words
    expect(small.length).toBeLessThan(large.length);

    const leviScore = score(small).find((s) => s.slug === "levi")!.score;
    const issacharScore = score(large).find((s) => s.slug === "issachar")!.score;
    expect(leviScore).toBeCloseTo(1);
    expect(issacharScore).toBeCloseTo(1);
  });

  it("ranks results highest-first", () => {
    const scores = score(wordsForTribe("levi"));
    expect(scores[0].slug).toBe("levi");
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });
});

/** Build a TribeScore[] from [slug, score] pairs for derive tests. */
function scores(...pairs: [string, number][]): TribeScore[] {
  return pairs.map(([slug, score]) => ({ slug, score }));
}

describe("deriveResult", () => {
  it("always names a Primary, even with all-zero scores", () => {
    const result = deriveResult(scores(["judah", 0], ["levi", 0], ["dan", 0]));
    expect(result.primary).toBeTruthy();
    expect(result.secondary).toBeUndefined();
  });

  it("picks the highest score as Primary regardless of input order", () => {
    const result = deriveResult(scores(["dan", 0.3], ["judah", 0.9], ["levi", 0.5]));
    expect(result.primary).toBe("judah");
  });

  it("names a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult(
      scores(["judah", 1], ["benjamin", 0.9], ["levi", 0.5]),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      scores(["judah", 1], ["benjamin", 0.5], ["levi", 0.4]),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scores(["judah", 1], ["benjamin", 0.9], ["levi", 0.88]),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });
});

describe("score + deriveResult end to end", () => {
  it("derives a Primary from a real selection", () => {
    // A Judah-leaning selection.
    const result = deriveResult(
      score(["Authoritative", "Courageous", "Honorable", "Sacrificial", "Bold"]),
    );
    expect(result.primary).toBe("judah");
  });
});
