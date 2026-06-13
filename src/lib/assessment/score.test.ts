import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { words, type AssessmentWord } from "./words";
import { score, deriveResult, type TribeScore } from "./score";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)?.score ?? 0;

describe("score — shared-word weighting", () => {
  // judah gets a sole word (weight 1) plus a shared word (weight 0.5);
  // levi gets only the shared half. Available: judah 1.5, levi 0.5.
  const list: AssessmentWord[] = [
    { word: "SoleJudah", tribes: ["judah"] },
    { word: "SharedJudahLevi", tribes: ["judah", "levi"] },
  ];

  it("contributes 0.5 to each tribe of a shared word", () => {
    const scores = score(["SharedJudahLevi"], list);
    // levi's only available point is the 0.5 share, fully earned → 1.0.
    expect(scoreFor("levi", scores)).toBeCloseTo(1);
    // judah earned just the 0.5 share of its 1.5 available → 1/3.
    expect(scoreFor("judah", scores)).toBeCloseTo(0.5 / 1.5);
  });

  it("weights a shared word at half a sole word for the same tribe", () => {
    const sole = scoreFor("judah", score(["SoleJudah"], list));
    const shared = scoreFor("judah", score(["SharedJudahLevi"], list));
    expect(sole).toBeCloseTo(2 * shared);
  });
});

describe("score — coverage-fair normalization", () => {
  // "big" tribe has twice the words of "small"; hitting the same fraction of
  // each must yield the same normalized score despite the raw-point gap.
  const list: AssessmentWord[] = [
    { word: "s1", tribes: ["levi"] },
    { word: "s2", tribes: ["levi"] },
    { word: "b1", tribes: ["dan"] },
    { word: "b2", tribes: ["dan"] },
    { word: "b3", tribes: ["dan"] },
    { word: "b4", tribes: ["dan"] },
  ];

  it("normalizes by each tribe's available points so coverage does not bias", () => {
    // Half of small (1 of 2) and half of big (2 of 4) selected.
    const scores = score(["s1", "b1", "b2"], list);
    expect(scoreFor("levi", scores)).toBeCloseTo(0.5);
    expect(scoreFor("dan", scores)).toBeCloseTo(0.5);
    // Raw earned points differ (1 vs 2); only normalization makes them equal.
  });

  it("returns 1.0 for a tribe whose every word is selected", () => {
    const scores = score(["s1", "s2"], list);
    expect(scoreFor("levi", scores)).toBeCloseTo(1);
    expect(scoreFor("dan", scores)).toBeCloseTo(0);
  });
});

describe("score — ranking and robustness", () => {
  it("scores every tribe in the real list, ranked descending in [0,1]", () => {
    const scores = score(["Authoritative", "Courageous", "Honorable"]);
    expect(scores).toHaveLength(tribes.length);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
    expect(scores[0].slug).toBe("judah");
  });

  it("ignores duplicate selections and unknown words", () => {
    const once = score(["Authoritative"]);
    const noisy = score(["Authoritative", "Authoritative", "NotAWord"]);
    expect(noisy).toEqual(once);
  });
});

describe("deriveResult", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult([
      { slug: "judah", score: 0.7 },
      { slug: "levi", score: 0.1 },
    ]);
    expect(result.primary.slug).toBe("judah");
  });

  it("throws on an empty score list", () => {
    expect(() => deriveResult([])).toThrow();
  });

  it("names a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "benjamin", score: 0.9 }, // within 20% of primary
      { slug: "dan", score: 0.5 }, // clearly behind the secondary
    ]);
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "benjamin", score: 0.5 }, // 50% behind → not near
      { slug: "dan", score: 0.1 },
    ]);
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "benjamin", score: 0.9 }, // near the primary, but...
      { slug: "dan", score: 0.88 }, // ...third is right on its heels
    ]);
    expect(result.secondary).toBeUndefined();
  });

  it("works end to end with the real word list and scoring", () => {
    // A Judah-leaning selection should headline Judah.
    const result = deriveResult(
      score(["Authoritative", "Courageous", "Honorable", "Sacrificial"], words),
    );
    expect(result.primary.slug).toBe("judah");
  });
});
