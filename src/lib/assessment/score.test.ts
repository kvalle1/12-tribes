import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "@/lib/assessment/words";
import {
  score,
  deriveResult,
  type TribeScore,
} from "@/lib/assessment/score";

const scoreOf = (scores: TribeScore[], slug: string) =>
  scores.find((s) => s.slug === slug)?.score ?? NaN;

const wordsForTribe = (slug: string) =>
  words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("score", () => {
  it("returns a normalized 0–1 score for every one of the 12 tribes", () => {
    const scores = score([]);
    expect(scores).toHaveLength(tribes.length);
    expect(new Set(scores.map((s) => s.slug)).size).toBe(tribes.length);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores nothing when no words are selected", () => {
    expect(score([]).every((s) => s.score === 0)).toBe(true);
  });

  it("returns scores sorted from highest to lowest", () => {
    const scores = score(["Courageous", "Honorable", "Bold"]);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });

  it("ignores words that are not in the list", () => {
    expect(score(["NotAWord", "AlsoFake"]).every((s) => s.score === 0)).toBe(
      true,
    );
  });

  it("splits a shared word 0.5 to each tribe — half a single-tribe word", () => {
    // 'Courageous' is Judah-only (weight 1); 'Bold' is shared Judah/Reuben
    // (weight 0.5). Over the same denominator, Bold contributes exactly half.
    const fromSingle = scoreOf(score(["Courageous"]), "judah");
    const fromShared = scoreOf(score(["Bold"]), "judah");
    expect(fromSingle).toBeGreaterThan(0);
    expect(fromShared).toBeCloseTo(fromSingle / 2);

    // The other half of 'Bold' lands on Reuben.
    expect(scoreOf(score(["Bold"]), "reuben")).toBeGreaterThan(0);
  });

  it("normalizes by coverage so small- and large-coverage tribes compete fairly", () => {
    // Levi maps to 6 words, Issachar to 11. Selecting all of a tribe's words
    // tops it out at exactly 1.0 regardless of how many words it has.
    expect(scoreOf(score(wordsForTribe("levi")), "levi")).toBeCloseTo(1);
    expect(scoreOf(score(wordsForTribe("issachar")), "issachar")).toBeCloseTo(
      1,
    );
  });
});

describe("deriveResult", () => {
  const s = (slug: string, value: number): TribeScore => ({
    slug,
    score: value,
  });

  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult([s("a", 0.3), s("b", 0.9), s("c", 0.5)]);
    expect(result.primary.slug).toBe("b");
  });

  it("returns a Primary even when everything scores zero", () => {
    const result = deriveResult([s("a", 0), s("b", 0), s("c", 0)]);
    expect(result.primary.slug).toBe("a");
    expect(result.secondary).toBeUndefined();
  });

  it("shows a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult([s("a", 1.0), s("b", 0.9), s("c", 0.5)]);
    expect(result.secondary?.slug).toBe("b");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([s("a", 1.0), s("b", 0.6), s("c", 0.1)]);
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([s("a", 1.0), s("b", 0.9), s("c", 0.85)]);
    expect(result.secondary).toBeUndefined();
  });

  it("throws when given no scores", () => {
    expect(() => deriveResult([])).toThrow();
  });
});
