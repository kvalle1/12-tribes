import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { score, deriveResult, type TribeScore } from "./score";

function scoreOf(scores: TribeScore[], slug: string): number {
  const entry = scores.find((s) => s.slug === slug);
  if (!entry) throw new Error(`no score for ${slug}`);
  return entry.score;
}

describe("score()", () => {
  it("returns a normalized 0–1 score for every tribe", () => {
    const scores = score(["Bold", "Courageous", "Honorable", "Wise"]);
    expect(scores).toHaveLength(tribes.length);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives every tribe a zero score when nothing is selected", () => {
    for (const s of score([])) {
      expect(s.score).toBe(0);
    }
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Bold" is shared (judah · reuben); "Authoritative" is judah-only.
    // Against the same judah denominator, Bold contributes half of what a
    // sole-tribe word does — proving the 0.5 split through normalized output.
    const sole = scoreOf(score(["Authoritative"]), "judah");
    const shared = scoreOf(score(["Bold"]), "judah");
    expect(shared).toBeCloseTo(sole / 2);

    // ...and the shared word lands on both mapped tribes, neither one.
    const boldScores = score(["Bold"]);
    expect(scoreOf(boldScores, "judah")).toBeGreaterThan(0);
    expect(scoreOf(boldScores, "reuben")).toBeGreaterThan(0);
  });

  it("normalizes by each tribe's available points, so coverage differences are fair", () => {
    // Levi has 6 words, Issachar has 11. Selecting every one of a tribe's words
    // yields a perfect 1.0 for that tribe regardless of how many words it has.
    const leviWords = ["Dedicated", "Devoted", "Exacting", "Guarding", "Precise", "Reverent"];
    const issacharWords = [
      "Analytical", "Cautious", "Discerning", "Insightful", "Learned",
      "Measured", "Observant", "Patient", "Perceptive", "Strategic", "Wise",
    ];
    expect(scoreOf(score(leviWords), "levi")).toBeCloseTo(1);
    expect(scoreOf(score(issacharWords), "issachar")).toBeCloseTo(1);
  });

  it("matches words case-insensitively and ignores unknown words", () => {
    const a = scoreOf(score(["courageous"]), "judah");
    const b = scoreOf(score(["Courageous", "Definitely-Not-A-Word"]), "judah");
    expect(a).toBeGreaterThan(0);
    expect(a).toBe(b);
  });
});

describe("deriveResult()", () => {
  const scores = (pairs: Record<string, number>): TribeScore[] =>
    Object.entries(pairs).map(([slug, score]) => ({ slug, score }));

  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(scores({ judah: 0.4, dan: 0.9, levi: 0.2 }));
    expect(result.primary.slug).toBe("dan");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult(scores({ judah: 1.0, benjamin: 0.9, dan: 0.5 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(scores({ judah: 1.0, benjamin: 0.5, dan: 0.4 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is essentially tied with the third tribe", () => {
    const result = deriveResult(scores({ judah: 1.0, benjamin: 0.9, dan: 0.85 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("derives a real result end-to-end from selected words", () => {
    const result = deriveResult(score(["Courageous", "Honorable", "Authoritative", "Sacrificial"]));
    expect(result.primary.slug).toBe("judah");
  });
});
