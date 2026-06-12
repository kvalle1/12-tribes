import { describe, it, expect } from "vitest";
import {
  score,
  deriveResult,
  type TribeScore,
} from "./score";

/** Convenience: look up one tribe's score by slug. */
function bySlug(scores: TribeScore[], slug: string): TribeScore {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found;
}

/** Build a full 12-tribe score array with the given normalized scores. */
function scoresFrom(overrides: Record<string, number>): TribeScore[] {
  return score([]).map((s) => ({ ...s, score: overrides[s.slug] ?? 0 }));
}

describe("score()", () => {
  it("returns a normalized 0–1 score for all 12 tribes", () => {
    const scores = score(["Authoritative"]);
    expect(scores).toHaveLength(12);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("awards a full point for an exclusive word", () => {
    const scores = score(["Authoritative"]); // Judah only
    expect(bySlug(scores, "judah").earned).toBe(1);
  });

  it("splits a shared word 0.5 to each of its two tribes", () => {
    const scores = score(["Bold"]); // Judah · Reuben
    expect(bySlug(scores, "judah").earned).toBe(0.5);
    expect(bySlug(scores, "reuben").earned).toBe(0.5);
  });

  it("splits the three-tribe word 0.5 to each tribe", () => {
    const scores = score(["Zealous"]); // Judah · Benjamin · Simeon
    expect(bySlug(scores, "judah").earned).toBe(0.5);
    expect(bySlug(scores, "benjamin").earned).toBe(0.5);
    expect(bySlug(scores, "simeon").earned).toBe(0.5);
  });

  it("ignores unrecognized words and is case-insensitive", () => {
    const scores = score(["authoritative", "not-a-real-word"]);
    expect(bySlug(scores, "judah").earned).toBe(1);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Naphtali earns 3 of its 6 available points; Gad earns 2.5 of its 5.
    // Different raw points, identical normalized score (0.5).
    const scores = score([
      "Creative",
      "Expressive",
      "Free-spirited", // Naphtali exclusives → 3
      "Battle-tested",
      "Gritty", // Gad exclusives → 2
      "Steady", // Gad (shared w/ Joseph) → +0.5
    ]);
    const naphtali = bySlug(scores, "naphtali");
    const gad = bySlug(scores, "gad");

    expect(naphtali.earned).toBe(3);
    expect(gad.earned).toBe(2.5);
    expect(naphtali.earned).not.toBe(gad.earned);
    expect(naphtali.score).toBeCloseTo(0.5, 10);
    expect(gad.score).toBeCloseTo(0.5, 10);
  });

  it("reaches a full normalized score at complete coverage", () => {
    // Every Naphtali word (all exclusive) → earned == available → 1.0.
    const scores = score([
      "Creative",
      "Expressive",
      "Free-spirited",
      "Graceful",
      "Healing",
      "Inspiring",
    ]);
    const naphtali = bySlug(scores, "naphtali");
    expect(naphtali.earned).toBe(naphtali.available);
    expect(naphtali.score).toBe(1);
  });
});

describe("deriveResult()", () => {
  it("always names a Primary (the highest score)", () => {
    const result = deriveResult(scoresFrom({ judah: 0.9, levi: 0.2 }));
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult(
      scoresFrom({ judah: 0.8, levi: 0.7, issachar: 0.5 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      scoresFrom({ judah: 0.8, levi: 0.5, issachar: 0.4 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scoresFrom({ judah: 0.8, levi: 0.7, issachar: 0.65 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("breaks ties by tribe number for deterministic ordering", () => {
    // Levi (#2) and Issachar (#3) tie for the top score.
    const result = deriveResult(scoresFrom({ levi: 0.6, issachar: 0.6 }));
    expect(result.primary.slug).toBe("levi");
  });

  it("names only a Primary when there is no signal (nothing selected)", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });
});

describe("score() + deriveResult() integration", () => {
  it("derives the dominant tribe as Primary from real selections", () => {
    const result = deriveResult(
      score([
        "Creative",
        "Expressive",
        "Free-spirited",
        "Graceful",
        "Healing",
        "Inspiring",
      ]),
    );
    expect(result.primary.slug).toBe("naphtali");
    expect(result.primary.score).toBe(1);
  });
});
