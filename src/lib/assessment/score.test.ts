import { describe, it, expect } from "vitest";
import { score, deriveResult, type TribeScore } from "./score";
import { words } from "./words";
import { tribes } from "@/lib/tribes";

const scoreOf = (scores: TribeScore[], slug: string): number =>
  scores.find((s) => s.slug === slug)!.score;

const wordsForTribe = (slug: string): string[] =>
  words.filter((m) => m.tribes.includes(slug)).map((m) => m.word);

describe("score()", () => {
  it("returns a normalized 0–1 score for every one of the 12 tribes", () => {
    const scores = score(["Bold", "Courageous", "Wise"]);
    expect(scores).toHaveLength(tribes.length);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("returns scores sorted highest-first", () => {
    const scores = score(wordsForTribe("judah"));
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    expect(scores.map((s) => s.slug)).toEqual(sorted.map((s) => s.slug));
    expect(scores[0].slug).toBe("judah");
  });

  it("splits a shared word 0.5/0.5: a shared Judah word scores half of a solo one", () => {
    // "Courageous" → Judah only (1.0 to Judah). "Bold" → Judah + Reuben (0.5 each).
    const solo = scoreOf(score(["Courageous"]), "judah");
    const shared = scoreOf(score(["Bold"]), "judah");
    expect(shared).toBeCloseTo(solo / 2);
    // The other half of "Bold" lands on Reuben.
    expect(scoreOf(score(["Bold"]), "reuben")).toBeGreaterThan(0);
  });

  it("normalizes by available points so small and large tribes compete fairly", () => {
    // Full coverage of a 6-word tribe and a larger tribe both reach 1.0.
    expect(scoreOf(score(wordsForTribe("levi")), "levi")).toBeCloseTo(1);
    expect(scoreOf(score(wordsForTribe("dan")), "dan")).toBeCloseTo(1);
  });

  it("ignores unknown words", () => {
    expect(score(["NotAWord"]).every((s) => s.score === 0)).toBe(true);
  });
});

describe("deriveResult()", () => {
  const mk = (entries: Array<[string, number]>): TribeScore[] =>
    entries.map(([slug, value]) => ({ slug, score: value }));

  it("always returns the highest-scoring tribe as the Primary", () => {
    const { primary, secondary } = deriveResult(
      mk([
        ["judah", 0.9],
        ["levi", 0.2],
        ["dan", 0.1],
      ]),
    );
    expect(primary.slug).toBe("judah");
    expect(secondary).toBeUndefined();
  });

  it("shows a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const { primary, secondary } = deriveResult(
      mk([
        ["judah", 1.0],
        ["levi", 0.9],
        ["dan", 0.5],
      ]),
    );
    expect(primary.slug).toBe("judah");
    expect(secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const { secondary } = deriveResult(
      mk([
        ["judah", 1.0],
        ["levi", 0.5],
        ["dan", 0.4],
      ]),
    );
    expect(secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const { secondary } = deriveResult(
      mk([
        ["judah", 1.0],
        ["levi", 0.85],
        ["dan", 0.8],
      ]),
    );
    expect(secondary).toBeUndefined();
  });
});
