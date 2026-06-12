import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import {
  score,
  deriveResult,
  type TribeScore,
  SECONDARY_NEAR_PRIMARY_MARGIN,
} from "./score";

/** Convenience: the normalized score for one slug from a scored set. */
function scoreFor(scores: TribeScore[], slug: string): number {
  return scores.find((s) => s.slug === slug)!.score;
}

/** Build a 12-tribe score set from a partial slug→score map (rest are 0). */
function makeScores(overrides: Record<string, number>): TribeScore[] {
  return tribes.map((t) => ({ slug: t.slug, score: overrides[t.slug] ?? 0 }));
}

describe("score", () => {
  it("returns a normalized 0–1 value for all 12 tribes", () => {
    const scores = score(["Bold", "Courageous", "Wise"]);
    expect(scores).toHaveLength(12);
    expect(new Set(scores.map((s) => s.slug))).toEqual(
      new Set(tribes.map((t) => t.slug)),
    );
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives a shared word half the weight a sole word gives the same tribe", () => {
    // "Courageous" is Judah-only (full weight); "Bold" is Judah+Reuben (half).
    const judahSole = scoreFor(score(["Courageous"]), "judah");
    const judahShared = scoreFor(score(["Bold"]), "judah");
    expect(judahSole).toBeCloseTo(2 * judahShared, 10);
  });

  it("credits both tribes of a shared word", () => {
    const scores = score(["Bold"]); // Judah + Reuben
    expect(scoreFor(scores, "judah")).toBeGreaterThan(0);
    expect(scoreFor(scores, "reuben")).toBeGreaterThan(0);
  });

  it("normalizes by each tribe's available points so all tribes top out at 1", () => {
    // Selecting every word earns every tribe its full available points, so a
    // low-coverage (Levi, 6 words) and high-coverage (Issachar/Dan, 10) tribe
    // both reach exactly 1.0 — coverage does not advantage anyone.
    const scores = score(words.map((w) => w.word));
    for (const s of scores) {
      expect(s.score).toBeCloseTo(1, 10);
    }
  });

  it("makes one match worth more to a low-coverage tribe than a high-coverage one", () => {
    // A raw point sum would tie these at 1 point each; normalization reflects
    // that a single match means more for the tribe with fewer available points.
    const scores = score(["Dedicated", "Analytical"]); // Levi(6), Issachar(10)
    expect(scoreFor(scores, "levi")).toBeGreaterThan(
      scoreFor(scores, "issachar"),
    );
  });

  it("ignores words that are not on the list and double selections", () => {
    const once = score(["Courageous"]);
    const noisy = score(["Courageous", "Courageous", "Not-A-Word"]);
    expect(noisy).toEqual(once);
  });

  it("is case- and whitespace-insensitive for selections", () => {
    expect(score(["  bOlD "])).toEqual(score(["Bold"]));
  });

  it("ranks results by score descending", () => {
    const scores = score(["Courageous", "Honorable", "Sacrificial", "Wise"]);
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    expect(scores).toEqual(sorted);
    expect(scores[0].slug).toBe("judah"); // three Judah-only words
  });
});

describe("deriveResult", () => {
  it("always returns a primary (the highest score)", () => {
    const result = deriveResult(makeScores({ judah: 0.9, levi: 0.4 }));
    expect(result.primary.slug).toBe("judah");
  });

  it("picks the primary regardless of input order", () => {
    const unsorted = makeScores({ levi: 0.3, judah: 0.9, dan: 0.6 });
    expect(deriveResult(unsorted).primary.slug).toBe("judah");
  });

  it("returns only a primary when every score is zero", () => {
    const result = deriveResult(makeScores({}));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("names a secondary when it is near the primary and clearly ahead of third", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, dan: 0.9, levi: 0.5 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("dan");
  });

  it("hides the secondary when it is far behind the primary", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, dan: 0.5, levi: 0.4 }),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("hides the secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, dan: 0.9, levi: 0.85 }),
    );
    expect(result.secondary).toBeUndefined();
  });

  it("respects the tunable near-primary margin at its boundary", () => {
    // Exactly at the 20% boundary the secondary still qualifies (>=).
    const atBoundary = 1.0 * (1 - SECONDARY_NEAR_PRIMARY_MARGIN);
    const result = deriveResult(
      makeScores({ judah: 1.0, dan: atBoundary, levi: 0.1 }),
    );
    expect(result.secondary?.slug).toBe("dan");
  });

  it("integrates with score(): a clearly single-tribe selection yields no secondary", () => {
    const result = deriveResult(score(["Courageous", "Honorable", "Sacrificial"]));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });
});
