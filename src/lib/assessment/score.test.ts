import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  score,
  deriveResult,
  SECONDARY_PRIMARY_RATIO,
  SECONDARY_THIRD_RATIO,
  type TribeScore,
} from "./score";

/** Read one tribe's score out of a score() result. */
function scoreOf(scores: TribeScore[], slug: string): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

describe("score", () => {
  it("returns a normalized 0–1 value for every tribe", () => {
    const scores = score(["Bold", "Courageous", "Wise"]);
    expect(scores).toHaveLength(tribes.length);
    for (const { score: value } of scores) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("scores zero for every tribe when nothing is selected", () => {
    for (const { score: value } of score([])) {
      expect(value).toBe(0);
    }
  });

  it("gives a sole-mapped word full weight (1) over the tribe's available points", () => {
    // Judah's available points across the list = 6.5; "Courageous" → Judah only.
    expect(scoreOf(score(["Courageous"]), "judah")).toBeCloseTo(1 / 6.5);
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Bold" → Judah (avail 6.5) and Reuben (avail 4.5), 0.5 to each.
    const scores = score(["Bold"]);
    expect(scoreOf(scores, "judah")).toBeCloseTo(0.5 / 6.5);
    expect(scoreOf(scores, "reuben")).toBeCloseTo(0.5 / 4.5);
  });

  it("splits a triple-shared word 0.5 to each of its three tribes", () => {
    // "Zealous" → Judah, Benjamin, Simeon, 0.5 to each.
    const scores = score(["Zealous"]);
    expect(scoreOf(scores, "judah")).toBeCloseTo(0.5 / 6.5);
    expect(scoreOf(scores, "benjamin")).toBeCloseTo(0.5 / 6.5);
    expect(scoreOf(scores, "simeon")).toBeCloseTo(0.5 / 6.0);
  });

  it("normalizes by available points so low- and high-coverage tribes compete fairly", () => {
    // One sole-mapped word for each: Naphtali (avail 6) vs Dan (avail 8).
    // Equal raw points (1 each), but normalization favors the lower-coverage tribe.
    const scores = score(["Creative", "Alert"]);
    const naphtali = scoreOf(scores, "naphtali"); // 1/6 ≈ 0.167
    const dan = scoreOf(scores, "dan"); // 1/8 = 0.125
    expect(naphtali).toBeCloseTo(1 / 6);
    expect(dan).toBeCloseTo(1 / 8);
    expect(naphtali).toBeGreaterThan(dan);
  });

  it("ignores unknown and duplicate selected words", () => {
    const base = score(["Courageous"]);
    const noisy = score(["Courageous", "Courageous", "NotAWord"]);
    expect(noisy).toEqual(base);
  });
});

describe("deriveResult", () => {
  const scores = (entries: Array<[string, number]>): TribeScore[] =>
    entries.map(([slug, value]) => ({ slug, score: value }));

  it("always names a Primary as the highest score", () => {
    const result = deriveResult(
      scores([
        ["judah", 0.4],
        ["levi", 0.9],
        ["dan", 0.1],
      ]),
    );
    expect(result.primary.slug).toBe("levi");
  });

  it("names a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      scores([
        ["judah", 1.0],
        ["levi", 0.9], // ≥ 0.8 × primary
        ["dan", 0.5], // ≤ 0.8 × secondary
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      scores([
        ["judah", 1.0],
        ["levi", 0.5], // < 0.8 × primary
        ["dan", 0.1],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scores([
        ["judah", 1.0],
        ["levi", 0.9], // near primary...
        ["dan", 0.85], // ...but third is within 20% of it
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("names no Secondary when only the Primary scores anything", () => {
    const result = deriveResult(
      scores([
        ["judah", 0.3],
        ["levi", 0],
        ["dan", 0],
      ]),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("exposes the thresholds as tunable constants", () => {
    expect(SECONDARY_PRIMARY_RATIO).toBeGreaterThan(0);
    expect(SECONDARY_PRIMARY_RATIO).toBeLessThanOrEqual(1);
    expect(SECONDARY_THIRD_RATIO).toBeGreaterThan(0);
    expect(SECONDARY_THIRD_RATIO).toBeLessThanOrEqual(1);
  });

  it("derives a real result end-to-end from selected words", () => {
    // A Dan-leaning selection: mostly Dan/Issachar discernment words.
    const result = deriveResult(
      score(["Alert", "Vigilant", "Watchful", "Skeptical", "Deliberate", "Cautious"]),
    );
    expect(result.primary.slug).toBe("dan");
  });
});
