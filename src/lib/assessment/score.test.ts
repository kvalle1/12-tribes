import { describe, it, expect } from "vitest";
import {
  score,
  deriveResult,
  type TribeScore,
} from "./score";
import { tribes } from "../tribes";

/** Build a minimal TribeScore for deriveResult tests (earned/available unused there). */
function ts(slug: string, value: number): TribeScore {
  return { slug, score: value, earned: 0, available: 0 };
}

function bySlug(scores: TribeScore[], slug: string): TribeScore {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found;
}

describe("score", () => {
  it("returns a normalized score for every tribe", () => {
    const scores = score(["Courageous"]);
    expect(scores).toHaveLength(tribes.length);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives a single-tribe word a full point to its tribe", () => {
    const scores = score(["Courageous"]); // Judah only
    expect(bySlug(scores, "judah").earned).toBe(1);
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    const scores = score(["Bold"]); // Judah · Reuben
    expect(bySlug(scores, "judah").earned).toBe(0.5);
    expect(bySlug(scores, "reuben").earned).toBe(0.5);
  });

  it("splits a three-tribe word 0.5 to each tribe", () => {
    const scores = score(["Zealous"]); // Judah · Benjamin · Simeon
    expect(bySlug(scores, "judah").earned).toBe(0.5);
    expect(bySlug(scores, "benjamin").earned).toBe(0.5);
    expect(bySlug(scores, "simeon").earned).toBe(0.5);
  });

  it("normalizes by each tribe's available points, so coverage is fair", () => {
    // Levi has fewer words than Issachar. Selecting 5 pure words from each:
    // Levi earns 5 of 5.5 available (≈0.909); Issachar earns 5 of 8.5 (≈0.588).
    // The smaller-coverage tribe is not penalized — it ranks higher here.
    const scores = score([
      "Dedicated",
      "Devoted",
      "Exacting",
      "Precise",
      "Reverent",
      "Analytical",
      "Insightful",
      "Learned",
      "Measured",
      "Patient",
    ]);

    expect(bySlug(scores, "levi").score).toBeCloseTo(5 / 5.5, 6);
    expect(bySlug(scores, "issachar").score).toBeCloseTo(5 / 8.5, 6);
    expect(bySlug(scores, "levi").score).toBeGreaterThan(
      bySlug(scores, "issachar").score,
    );

    // Sorted output puts the fairly-normalized winner first.
    expect(scores[0].slug).toBe("levi");
    expect(scores[1].slug).toBe("issachar");
  });

  it("ignores unknown words and is case-insensitive", () => {
    const scores = score(["courageous", "not-a-real-word"]);
    expect(bySlug(scores, "judah").earned).toBe(1);
  });
});

describe("deriveResult", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult([ts("a", 0.4), ts("b", 0.9), ts("c", 0.1)]);
    expect(result.primary.slug).toBe("b");
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult([ts("a", 1.0), ts("b", 0.9), ts("c", 0.5)]);
    expect(result.secondary?.slug).toBe("b");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    // 0.6 is below 0.8 * 1.0, so the runner-up does not qualify.
    const result = deriveResult([ts("a", 1.0), ts("b", 0.6), ts("c", 0.3)]);
    expect(result.secondary).toBeUndefined();
    expect(result.primary.slug).toBe("a");
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    // 0.85 is within 20% of the Primary, but not clearly ahead of 0.8 third.
    const result = deriveResult([ts("a", 1.0), ts("b", 0.85), ts("c", 0.8)]);
    expect(result.secondary).toBeUndefined();
  });

  it("names no Secondary when only a Primary scored", () => {
    const result = deriveResult([ts("a", 0.7), ts("b", 0), ts("c", 0)]);
    expect(result.secondary).toBeUndefined();
    expect(result.primary.slug).toBe("a");
  });

  it("throws on an empty score list", () => {
    expect(() => deriveResult([])).toThrow();
  });
});
