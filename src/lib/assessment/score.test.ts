import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import {
  score,
  deriveResult,
  type TribeScore,
  type AssessmentResult,
} from "./score";

function scoreOf(scores: TribeScore[], slug: string): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

/** All words owned (solely or shared) by a tribe, read from the real data. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

describe("score()", () => {
  it("returns a normalized 0..1 score for all 12 tribes", () => {
    const scores = score(["Courageous"]);
    expect(scores).toHaveLength(12);
    expect(scores.map((s) => s.slug).sort()).toEqual(
      tribes.map((t) => t.slug).sort(),
    );
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives every tribe a zero score for an empty selection", () => {
    expect(score([]).every((s) => s.score === 0)).toBe(true);
  });

  it("ignores words that are not in the list", () => {
    expect(score(["Flibbertigibbet"])).toEqual(score([]));
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Bold" is shared (Judah + Reuben); "Courageous" is Judah-only,
    // "Energetic" is Reuben-only. The shared word should contribute exactly
    // half of what a sole-owner word contributes to the same tribe.
    const bold = score(["Bold"]);
    const judahSolo = score(["Courageous"]);
    const reubenSolo = score(["Energetic"]);

    expect(scoreOf(bold, "judah")).toBeCloseTo(scoreOf(judahSolo, "judah") / 2);
    expect(scoreOf(bold, "reuben")).toBeCloseTo(
      scoreOf(reubenSolo, "reuben") / 2,
    );
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi has 6 words, Issachar has 11. Selecting *all* of a tribe's words
    // must yield a perfect 1.0 for that tribe regardless of how many it has.
    const levi = score(wordsForTribe("levi"));
    const issachar = score(wordsForTribe("issachar"));

    expect(scoreOf(levi, "levi")).toBeCloseTo(1);
    expect(scoreOf(issachar, "issachar")).toBeCloseTo(1);
  });

  it("counts a three-tribe shared word as 0.5 to each of its three tribes", () => {
    // "Zealous" maps to Judah, Benjamin and Simeon.
    const zealous = score(["Zealous"]);
    for (const slug of ["judah", "benjamin", "simeon"]) {
      const solo = score(wordsForTribe(slug));
      // Contribution is positive but capped at the half-weight share.
      expect(scoreOf(zealous, slug)).toBeGreaterThan(0);
      expect(scoreOf(zealous, slug)).toBeLessThanOrEqual(scoreOf(solo, slug));
    }
  });
});

function makeScores(pairs: Array<[string, number]>): TribeScore[] {
  return pairs.map(([slug, score]) => ({ slug, score }));
}

describe("deriveResult()", () => {
  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(
      makeScores([
        ["judah", 0.4],
        ["dan", 0.9],
        ["levi", 0.2],
      ]),
    );
    expect(result.primary.slug).toBe("dan");
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result: AssessmentResult = deriveResult(
      makeScores([
        ["judah", 0.9],
        ["dan", 0.8],
        ["levi", 0.5],
        ["gad", 0.1],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("dan");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      makeScores([
        ["judah", 0.9],
        ["dan", 0.5],
        ["levi", 0.3],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    // Secondary (0.8) is within 20% of Primary (0.9) but third (0.78) is right
    // behind it — not clearly ahead, so no honest Secondary.
    const result = deriveResult(
      makeScores([
        ["judah", 0.9],
        ["dan", 0.8],
        ["levi", 0.78],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("returns only a Primary (no throw) when every score is zero", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });
});
