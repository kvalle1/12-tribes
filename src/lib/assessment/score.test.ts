import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "@/lib/assessment/words";
import {
  score,
  deriveResult,
  type TribeScore,
} from "@/lib/assessment/score";

const scoreFor = (scores: TribeScore[], slug: string): number => {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
};

const wordsFor = (slug: string): string[] =>
  words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("score", () => {
  it("returns a normalized 0–1 score for all 12 tribes", () => {
    const scores = score(["Authoritative"]);
    expect(scores).toHaveLength(12);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores everything 0 for an empty selection", () => {
    for (const s of score([])) expect(s.score).toBe(0);
  });

  it("ignores words that are not in the list", () => {
    expect(score(["Authoritative", "Flibbertigibbet"])).toEqual(
      score(["Authoritative"]),
    );
  });

  it("returns scores sorted descending", () => {
    const scores = score(wordsFor("dan"));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
  });

  // A shared word contributes 0.5 to each of its tribes: half of what a solo
  // word contributes to the same tribe. "Bold" is shared (judah + reuben);
  // "Authoritative" is solo judah and "Energetic" is solo reuben.
  it("gives a shared word half the weight of a solo word, to each tribe", () => {
    const judahSolo = scoreFor(score(["Authoritative"]), "judah");
    const judahShared = scoreFor(score(["Bold"]), "judah");
    expect(judahSolo).toBeCloseTo(2 * judahShared);

    const reubenSolo = scoreFor(score(["Energetic"]), "reuben");
    const reubenShared = scoreFor(score(["Bold"]), "reuben");
    expect(reubenSolo).toBeCloseTo(2 * reubenShared);
  });

  // Normalization is by each tribe's available points, so selecting every word
  // mapped to a tribe yields a full 1.0 regardless of how many words that is —
  // a low-coverage (Levi, 6 words) and high-coverage (Dan, 11 words) tribe
  // both reach 1.0 and so compete fairly.
  it("normalizes fairly across uneven coverage", () => {
    expect(scoreFor(score(wordsFor("levi")), "levi")).toBeCloseTo(1);
    expect(scoreFor(score(wordsFor("dan")), "dan")).toBeCloseTo(1);
  });
});

describe("deriveResult", () => {
  const make = (entries: [string, number][]): TribeScore[] =>
    entries
      .map(([slug, score]) => ({ slug, score }))
      .sort((a, b) => b.score - a.score);

  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(
      make([
        ["judah", 0.7],
        ["dan", 0.3],
        ["levi", 0.1],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of third", () => {
    const result = deriveResult(
      make([
        ["judah", 1.0],
        ["dan", 0.9],
        ["levi", 0.5],
      ]),
    );
    expect(result.secondary?.slug).toBe("dan");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      make([
        ["judah", 1.0],
        ["dan", 0.5],
        ["levi", 0.1],
      ]),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      make([
        ["judah", 1.0],
        ["dan", 0.9],
        ["levi", 0.85],
      ]),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("returns only a Primary when a single tribe scored", () => {
    const result = deriveResult(score(["Authoritative"]));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("throws on an empty score list", () => {
    expect(() => deriveResult([])).toThrow();
  });

  it("derives a coherent result end to end from selected words", () => {
    // A Judah-heavy selection with some Dan flavor.
    const result = deriveResult(
      score(["Authoritative", "Courageous", "Honorable", "Sacrificial", "Alert"]),
    );
    expect(tribes.some((t) => t.slug === result.primary.slug)).toBe(true);
    expect(result.primary.score).toBeGreaterThan(0);
  });
});
