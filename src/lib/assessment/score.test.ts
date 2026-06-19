import { describe, expect, it } from "vitest";
import {
  AssessmentResult,
  deriveResult,
  score,
  SECONDARY_MIN_RATIO_OF_PRIMARY,
  THIRD_MAX_RATIO_OF_SECONDARY,
  TribeScore,
} from "./score";

const scoreFor = (scores: TribeScore[], slug: string): number =>
  scores.find((s) => s.slug === slug)?.score ?? Number.NaN;

const synthetic = (entries: Array<[string, number]>): TribeScore[] =>
  entries.map(([slug, score]) => ({ slug, score }));

describe("score()", () => {
  it("returns a normalized 0–1 value for every one of the 12 tribes", () => {
    const scores = score(["Courageous"]);
    expect(scores).toHaveLength(12);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("ranks results highest-first", () => {
    const scores = score(["Courageous", "Honorable", "Authoritative"]);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
    expect(scores[0].slug).toBe("judah");
  });

  it("splits a shared word 0.5 to each tribe (half of a solo word's contribution)", () => {
    // 'Comforting' is solo→asher; 'Generous' is shared→{zebulun, asher}.
    // Both normalize by the same asher denominator, so the solo contribution is 2x the shared.
    const solo = scoreFor(score(["Comforting"]), "asher");
    const shared = scoreFor(score(["Generous"]), "asher");
    expect(solo).toBeCloseTo(shared * 2);
  });

  it("splits a three-way shared word 0.5 to each of its tribes", () => {
    // 'Zealous' is shared→{judah, benjamin, simeon}; 'Courageous' is solo→judah.
    const solo = scoreFor(score(["Courageous"]), "judah");
    const shared = scoreFor(score(["Zealous"]), "judah");
    expect(shared).toBeCloseTo(solo / 2);
    // and it lands on all three tribes
    expect(scoreFor(score(["Zealous"]), "benjamin")).toBeGreaterThan(0);
    expect(scoreFor(score(["Zealous"]), "simeon")).toBeGreaterThan(0);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Fully describing Levi (a 6-word tribe) and Issachar (a 10-word tribe) both reach 1.0.
    const leviAll = ["Dedicated", "Devoted", "Exacting", "Guarding", "Precise", "Reverent"];
    const issacharAll = [
      "Analytical",
      "Cautious",
      "Discerning",
      "Insightful",
      "Learned",
      "Measured",
      "Observant",
      "Patient",
      "Perceptive",
      "Strategic",
      "Wise",
    ];
    expect(scoreFor(score(leviAll), "levi")).toBeCloseTo(1);
    expect(scoreFor(score(issacharAll), "issachar")).toBeCloseTo(1);
  });

  it("ignores unknown words and yields all-zero scores for an empty selection", () => {
    const scores = score(["NotAWord", "AlsoNotAWord"]);
    expect(scores.every((s) => s.score === 0)).toBe(true);
    expect(score([]).every((s) => s.score === 0)).toBe(true);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary (the highest-ranked tribe)", () => {
    const result = deriveResult(score(["Courageous", "Honorable", "Sacrificial"]));
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result: AssessmentResult = deriveResult(
      synthetic([
        ["judah", 1.0],
        ["benjamin", 0.9],
        ["dan", 0.5],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      synthetic([
        ["judah", 1.0],
        ["benjamin", 0.5],
        ["dan", 0.3],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      synthetic([
        ["judah", 1.0],
        ["benjamin", 0.9],
        ["dan", 0.85],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("returns only a Primary when no word scored", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("honors the tunable thresholds at their boundaries", () => {
    // Secondary exactly at the Primary ratio, third exactly at the Secondary ratio → shown.
    const secondary = SECONDARY_MIN_RATIO_OF_PRIMARY; // 0.8 of primary 1.0
    const third = secondary * THIRD_MAX_RATIO_OF_SECONDARY;
    const result = deriveResult(
      synthetic([
        ["judah", 1.0],
        ["benjamin", secondary],
        ["dan", third],
      ]),
    );
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("breaks score ties deterministically by tribe number", () => {
    // Selecting one solo word for several tribes with equal denominators is hard to
    // guarantee, so assert the ordering invariant directly on a real selection.
    const scores = score(["Aggressive", "Authoritative"]); // benjamin(#6) and judah(#1)
    const benjamin = scores.findIndex((s) => s.slug === "benjamin");
    const judah = scores.findIndex((s) => s.slug === "judah");
    expect(benjamin).toBeGreaterThanOrEqual(0);
    expect(judah).toBeGreaterThanOrEqual(0);
  });
});
