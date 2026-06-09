import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  score,
  deriveResult,
  type TribeScore,
} from "./score";

const scoreOf = (scores: TribeScore[], slug: string): number =>
  scores.find((s) => s.slug === slug)!.score;

describe("score", () => {
  it("returns one normalized [0,1] entry for every tribe", () => {
    const result = score(["Courageous"]);
    expect(result).toHaveLength(tribes.length);
    for (const s of result) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("returns entries sorted by score descending", () => {
    const result = score(["Courageous", "Bold", "Honorable"]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("splits a shared word as 0.5 to each of its tribes", () => {
    // "Bold" → judah + reuben (shared, 0.5 each).
    const shared = score(["Bold"]);
    expect(scoreOf(shared, "judah")).toBeCloseTo(0.5 / 6.5, 10);
    expect(scoreOf(shared, "reuben")).toBeCloseTo(0.5 / 4.5, 10);

    // "Courageous" → judah only (full point): exactly double Bold's judah share.
    const single = score(["Courageous"]);
    expect(scoreOf(single, "judah")).toBeCloseTo(1 / 6.5, 10);
    expect(scoreOf(single, "judah")).toBeCloseTo(2 * scoreOf(shared, "judah"), 10);
  });

  it("normalizes by each tribe's available points, so different-sized tribes compete fairly", () => {
    // Same raw points (0.5) earned for judah and reuben from one shared word,
    // but reuben has fewer available points, so it scores higher — coverage-fair.
    const shared = score(["Bold"]);
    expect(scoreOf(shared, "reuben")).toBeGreaterThan(scoreOf(shared, "judah"));

    // Selecting every one of a tribe's words yields exactly 1.0, regardless of
    // how many words that tribe has — a 6-word tribe and an 8.5-point tribe both
    // top out at 1.0.
    const allNaphtali = score([
      "Creative",
      "Expressive",
      "Free-spirited",
      "Graceful",
      "Healing",
      "Inspiring",
    ]);
    expect(scoreOf(allNaphtali, "naphtali")).toBeCloseTo(1, 10);

    // Half of a small tribe's single-weight words → 0.5 of its own total.
    const halfNaphtali = score(["Creative", "Expressive", "Free-spirited"]);
    expect(scoreOf(halfNaphtali, "naphtali")).toBeCloseTo(0.5, 10);
  });

  it("ignores unknown words and counts a repeated word once", () => {
    const a = score(["Courageous"]);
    const b = score(["Courageous", "NotAWord", "Courageous"]);
    expect(scoreOf(b, "judah")).toBeCloseTo(scoreOf(a, "judah"), 10);
  });
});

describe("deriveResult", () => {
  const mk = (entries: Array<[string, number]>): TribeScore[] =>
    entries.map(([slug, s]) => ({ slug, score: s }));

  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(
      // intentionally unsorted
      mk([
        ["levi", 0.3],
        ["judah", 0.9],
        ["dan", 0.5],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
  });

  it("returns a Secondary when it is near Primary and clearly ahead of third", () => {
    const result = deriveResult(
      mk([
        ["judah", 0.9],
        ["benjamin", 0.8], // within 20% of primary (>= 0.72)
        ["dan", 0.5], // well behind secondary (<= 0.64)
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      mk([
        ["judah", 0.9],
        ["benjamin", 0.5], // below 0.72 → not near primary
        ["dan", 0.2],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      mk([
        ["judah", 0.9],
        ["benjamin", 0.8], // near primary...
        ["dan", 0.78], // ...but third is right behind it → not clearly ahead
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("returns only a Primary when nothing else scored", () => {
    const result = deriveResult(mk([["judah", 0.4], ["levi", 0], ["dan", 0]]));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("works end-to-end with real scored words", () => {
    // A Judah-heavy selection with Benjamin as a genuine second.
    const scores = score([
      "Authoritative",
      "Courageous",
      "Honorable",
      "Sacrificial",
      "Aggressive",
      "Fierce",
    ]);
    const result = deriveResult(scores);
    expect(result.primary.slug).toBe("judah");
  });
});
