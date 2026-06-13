import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  AssessmentResult,
  deriveResult,
  score,
  TribeScore,
} from "./score";

/** Convenience: pull a single tribe's score out of the ranked array. */
function scoreFor(scores: TribeScore[], slug: string): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

describe("score()", () => {
  it("returns a normalized 0–1 score for all 12 tribes", () => {
    const scores = score(["Authoritative", "Wise"]);
    expect(scores).toHaveLength(tribes.length);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives a single-tribe word the full weight, normalized by available points", () => {
    // "Authoritative" maps to Judah only. Judah's available points total 6.5.
    const scores = score(["Authoritative"]);
    expect(scoreFor(scores, "judah")).toBeCloseTo(1 / 6.5, 10);
  });

  it("splits a shared word 0.5 to each of its mapped tribes", () => {
    // "Bold" is shared between Judah (avail 6.5) and Reuben (avail 4.5).
    const scores = score(["Bold"]);
    expect(scoreFor(scores, "judah")).toBeCloseTo(0.5 / 6.5, 10);
    expect(scoreFor(scores, "reuben")).toBeCloseTo(0.5 / 4.5, 10);
  });

  it("splits a three-way shared word 0.5 to each mapped tribe", () => {
    // "Zealous" is shared across Judah, Benjamin, and Simeon.
    const scores = score(["Zealous"]);
    expect(scoreFor(scores, "judah")).toBeCloseTo(0.5 / 6.5, 10);
    expect(scoreFor(scores, "benjamin")).toBeCloseTo(0.5 / 6.5, 10);
    expect(scoreFor(scores, "simeon")).toBeCloseTo(0.5 / 6.0, 10);
  });

  it("normalizes by coverage so a smaller tribe and a larger tribe compete fairly", () => {
    // Equal raw points (1.0 each) for a single Zebulun word and a single Dan
    // word, but Zebulun (avail 4.5) outscores Dan (avail 8.0) once normalized.
    const scores = score(["Resourceful", "Alert"]);
    expect(scoreFor(scores, "zebulun")).toBeCloseTo(1 / 4.5, 10);
    expect(scoreFor(scores, "dan")).toBeCloseTo(1 / 8.0, 10);
    expect(scoreFor(scores, "zebulun")).toBeGreaterThan(scoreFor(scores, "dan"));
  });

  it("reaches a perfect 1.0 when a tribe's full available points are selected", () => {
    // All five Zebulun words sum to its 4.5 available points.
    const scores = score([
      "Enterprising",
      "Expansive",
      "Generous",
      "Prosperous",
      "Resourceful",
    ]);
    expect(scoreFor(scores, "zebulun")).toBeCloseTo(1, 10);
  });

  it("ranks the highest-scoring tribe first", () => {
    const scores = score(["Authoritative", "Courageous", "Honorable"]);
    expect(scores[0].slug).toBe("judah");
  });

  it("ignores unknown words and duplicates", () => {
    const once = score(["Authoritative"]);
    const noisy = score(["Authoritative", "Authoritative", "Notaword"]);
    expect(noisy).toEqual(once);
  });

  it("is case-insensitive on word input", () => {
    expect(score(["authoritative"])).toEqual(score(["Authoritative"]));
  });
});

describe("deriveResult()", () => {
  const make = (entries: [string, number][]): TribeScore[] =>
    entries.map(([slug, s]) => ({ slug, score: s }));

  it("always names a Primary (the highest score)", () => {
    const result = deriveResult(
      make([
        ["judah", 0.4],
        ["dan", 0.9],
        ["levi", 0.2],
      ]),
    );
    expect(result.primary.slug).toBe("dan");
  });

  it("returns a Primary even when every score is zero", () => {
    const result: AssessmentResult = deriveResult(
      make([
        ["judah", 0],
        ["dan", 0],
      ]),
    );
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("names a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      make([
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
      make([
        ["judah", 1.0],
        ["benjamin", 0.5],
        ["dan", 0.1],
      ]),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is roughly tied with the third tribe", () => {
    const result = deriveResult(
      make([
        ["judah", 1.0],
        ["benjamin", 0.85],
        ["dan", 0.85],
      ]),
    );
    // benjamin is near the primary, but not clearly ahead of dan.
    expect(result.secondary).toBeUndefined();
  });
});
