import { describe, expect, it } from "vitest";
import {
  deriveResult,
  score,
  type TribeScore,
} from "./score";

/** Convenience: pull a single tribe's score out of a `score()` result. */
function forTribe(scores: TribeScore[], slug: string): TribeScore {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found;
}

/** Build a synthetic score list (unnamed tribes default to 0). */
function scoresFrom(partial: Record<string, number>): TribeScore[] {
  return Object.entries(partial).map(([slug, value]) => ({
    slug,
    earned: value,
    available: 1,
    score: value,
  }));
}

describe("score()", () => {
  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Bold" maps to Judah + Reuben.
    const result = score(["Bold"]);
    expect(forTribe(result, "judah").earned).toBe(0.5);
    expect(forTribe(result, "reuben").earned).toBe(0.5);
  });

  it("gives a single-tribe word its full 1.0 weight", () => {
    const result = score(["Courageous"]); // Judah only
    expect(forTribe(result, "judah").earned).toBe(1);
  });

  it("splits a three-tribe shared word 0.5 to each", () => {
    const result = score(["Zealous"]); // Judah + Benjamin + Simeon
    expect(forTribe(result, "judah").earned).toBe(0.5);
    expect(forTribe(result, "benjamin").earned).toBe(0.5);
    expect(forTribe(result, "simeon").earned).toBe(0.5);
  });

  it("returns a normalized 0–1 score for every tribe", () => {
    const result = score(["Courageous"]);
    expect(result).toHaveLength(12);
    for (const s of result) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Same raw earned (5.0) for a low-coverage tribe (Levi) and a high-coverage
    // tribe (Issachar) yields very different normalized scores — the smaller
    // tribe is not penalized for having fewer words.
    const leviWords = ["Dedicated", "Devoted", "Exacting", "Precise", "Reverent"];
    const issacharWords = [
      "Analytical",
      "Insightful",
      "Learned",
      "Measured",
      "Patient",
    ];

    const levi = forTribe(score(leviWords), "levi");
    const issachar = forTribe(score(issacharWords), "issachar");

    expect(levi.earned).toBe(5);
    expect(issachar.earned).toBe(5);
    // Levi's available pool is smaller, so the same raw points normalize higher.
    expect(levi.score).toBeGreaterThan(issachar.score);
    expect(levi.score).toBeCloseTo(5 / 5.5, 5);
    expect(issachar.score).toBeCloseTo(5 / 8.5, 5);
  });

  it("can reach a normalized score of 1.0 when all of a tribe's points are earned", () => {
    // Levi's full pool: Dedicated, Devoted, Exacting, Precise, Reverent (1.0
    // each) + Guarding (0.5, shared with Benjamin) = 5.5.
    const allLevi = [
      "Dedicated",
      "Devoted",
      "Exacting",
      "Precise",
      "Reverent",
      "Guarding",
    ];
    expect(forTribe(score(allLevi), "levi").score).toBeCloseTo(1, 5);
  });

  it("treats the selection as a set (duplicates and unknown words don't change scores)", () => {
    const once = forTribe(score(["Courageous"]), "judah");
    const twice = forTribe(score(["Courageous", "Courageous", "Nonsense"]), "judah");
    expect(twice.earned).toBe(once.earned);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult(
      scoresFrom({ judah: 0.9, levi: 0.3, dan: 0.1 }),
    );
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      scoresFrom({ judah: 1.0, benjamin: 0.9, dan: 0.5 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind Primary", () => {
    const result = deriveResult(
      scoresFrom({ judah: 1.0, benjamin: 0.6, dan: 0.3 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scoresFrom({ judah: 1.0, benjamin: 0.85, dan: 0.84 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("never names a zero-scoring Secondary", () => {
    const result = deriveResult(scoresFrom({ judah: 0.5, benjamin: 0 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("integrates with score(): a Judah-heavy selection yields a Judah Primary", () => {
    const result = deriveResult(
      score(["Authoritative", "Courageous", "Honorable", "Sacrificial"]),
    );
    expect(result.primary.slug).toBe("judah");
  });
});
