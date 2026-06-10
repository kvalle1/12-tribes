import { describe, it, expect } from "vitest";
import {
  score,
  deriveResult,
  type TribeScore,
  SECONDARY_NEAR_PRIMARY_RATIO,
} from "./score";

function scoreFor(scores: TribeScore[], slug: string): TribeScore {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found;
}

/** Build a synthetic TribeScore for testing deriveResult in isolation. */
function ts(slug: string, value: number): TribeScore {
  return { slug, score: value, earned: value, available: 1 };
}

describe("score()", () => {
  it("returns a score entry for all 12 tribes", () => {
    expect(score([]).length).toBe(12);
  });

  it("gives a single-tribe word a full point", () => {
    const scores = score(["Aggressive"]); // benjamin only
    expect(scoreFor(scores, "benjamin").earned).toBe(1);
  });

  it("splits a shared (two-tribe) word 0.5 to each tribe", () => {
    const scores = score(["Bold"]); // judah · reuben
    expect(scoreFor(scores, "judah").earned).toBe(0.5);
    expect(scoreFor(scores, "reuben").earned).toBe(0.5);
  });

  it("splits the three-tribe word 0.5 to each of its tribes", () => {
    const scores = score(["Zealous"]); // judah · benjamin · simeon
    expect(scoreFor(scores, "judah").earned).toBe(0.5);
    expect(scoreFor(scores, "benjamin").earned).toBe(0.5);
    expect(scoreFor(scores, "simeon").earned).toBe(0.5);
  });

  it("normalizes each tribe to earned/available within [0, 1]", () => {
    const scores = score(["Aggressive", "Bold", "Zealous"]);
    for (const tribe of scores) {
      expect(tribe.score).toBeGreaterThanOrEqual(0);
      expect(tribe.score).toBeLessThanOrEqual(1);
      if (tribe.available > 0) {
        expect(tribe.score).toBeCloseTo(tribe.earned / tribe.available);
      }
    }
  });

  it("normalizes by available points so coverage does not bias the result", () => {
    // Fully express Levi (small available) + one Issachar word (large available).
    const allLevi = [
      "Dedicated",
      "Devoted",
      "Exacting",
      "Precise",
      "Reverent",
      "Guarding",
    ];
    const scores = score([...allLevi, "Analytical"]);
    const levi = scoreFor(scores, "levi");
    const issachar = scoreFor(scores, "issachar");

    // A fully-expressed tribe maxes out at 1 regardless of its coverage size.
    expect(levi.score).toBe(1);
    expect(issachar.earned).toBe(1);
    // Issachar has MORE total available points, yet a fully-expressed Levi
    // outranks a barely-expressed Issachar — that is coverage-fairness.
    expect(issachar.available).toBeGreaterThan(levi.available);
    expect(levi.score).toBeGreaterThan(issachar.score);
  });
});

describe("deriveResult()", () => {
  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult([ts("judah", 1), ts("levi", 0.4), ts("dan", 0.2)]);
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of third", () => {
    const result = deriveResult([
      ts("judah", 1.0),
      ts("levi", 0.9), // within 20% of primary
      ts("dan", 0.5), // clearly behind levi
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      ts("judah", 1.0),
      ts("levi", 0.5), // below the near-primary ratio
      ts("dan", 0.4),
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      ts("judah", 1.0),
      ts("levi", 0.9), // near primary...
      ts("dan", 0.88), // ...but not clearly ahead of third
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("uses a tunable near-primary threshold", () => {
    expect(SECONDARY_NEAR_PRIMARY_RATIO).toBeGreaterThan(0);
    expect(SECONDARY_NEAR_PRIMARY_RATIO).toBeLessThanOrEqual(1);
  });

  it("end-to-end: a Judah-leaning selection yields a Judah Primary", () => {
    const result = deriveResult(
      score([
        "Authoritative",
        "Courageous",
        "Honorable",
        "Sacrificial",
        "Bold",
        "Strong",
        "Fervent",
        "Protective",
      ]),
    );
    expect(result.primary.slug).toBe("judah");
  });
});
