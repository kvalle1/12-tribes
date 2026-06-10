import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "./words";
import {
  score,
  deriveResult,
  type TribeScore,
  SECONDARY_WITHIN,
  SECONDARY_LEAD_OVER_THIRD,
} from "./score";

/** All words that map to a given tribe slug (used to drive scoring inputs). */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

const scoreFor = (slug: string, result: TribeScore[]) =>
  result.find((s) => s.slug === slug)!.score;

describe("score", () => {
  it("returns a normalized 0–1 value for all 12 tribes", () => {
    const result = score(["Bold", "Cunning", "Healing", "Just"]);
    expect(result).toHaveLength(12);
    expect(result.map((s) => s.slug).sort()).toEqual(
      tribes.map((t) => t.slug).sort(),
    );
    for (const s of result) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores every tribe at 0 for an empty selection", () => {
    for (const s of score([])) expect(s.score).toBe(0);
  });

  it("ignores unknown words", () => {
    expect(score(["NotAWord", "AlsoFake"])).toEqual(score([]));
  });

  it("splits a shared word as 0.5 to each tribe (half an exclusive word)", () => {
    // "Courageous" maps to judah only (weight 1.0); "Bold" maps to judah +
    // reuben (weight 0.5 to judah). Same denominator, so judah from the
    // exclusive word should be exactly double judah from the shared word.
    const judahFromExclusive = scoreFor("judah", score(["Courageous"]));
    const judahFromShared = scoreFor("judah", score(["Bold"]));
    expect(judahFromExclusive).toBeCloseTo(judahFromShared * 2);
    // ...and the same shared word feeds reuben at half of an exclusive reuben
    // word ("Energetic" → reuben only). Each tribe normalizes by its own
    // available points, so the two halves are not equal to each other.
    const reubenFromExclusive = scoreFor("reuben", score(["Energetic"]));
    const reubenFromShared = scoreFor("reuben", score(["Bold"]));
    expect(reubenFromExclusive).toBeCloseTo(reubenFromShared * 2);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Selecting every word that maps to a tribe yields exactly 1.0 for it,
    // whether it is a low-coverage (zebulun) or high-coverage (dan) tribe — a
    // raw point sum would instead structurally favor the high-coverage tribe.
    for (const t of tribes) {
      const full = score(wordsForTribe(t.slug));
      expect(scoreFor(t.slug, full)).toBeCloseTo(1);
    }
  });
});

/** Builds a 12-length score array from a slug→score map (others default to 0). */
function scores(overrides: Record<string, number>): TribeScore[] {
  return tribes.map((t) => ({ slug: t.slug, score: overrides[t.slug] ?? 0 }));
}

describe("deriveResult", () => {
  it("always returns the highest-scoring tribe as Primary, regardless of order", () => {
    const { primary } = deriveResult(scores({ levi: 0.3, dan: 0.7, asher: 0.5 }));
    expect(primary.slug).toBe("dan");
  });

  it("returns a Secondary when it is near Primary and clearly ahead of the third", () => {
    const { primary, secondary } = deriveResult(
      scores({ judah: 0.9, benjamin: 0.8, dan: 0.5 }),
    );
    expect(primary.slug).toBe("judah");
    expect(secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    // 0.5 < 0.9 * (1 - 0.2) = 0.72
    const { secondary } = deriveResult(
      scores({ judah: 0.9, benjamin: 0.5, dan: 0.4 }),
    );
    expect(secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    // 0.8 is near primary (>= 0.72) but not clearly ahead of third:
    // 0.8 < 0.75 * (1 + 0.2) = 0.9
    const { secondary } = deriveResult(
      scores({ judah: 0.9, benjamin: 0.8, dan: 0.75 }),
    );
    expect(secondary).toBeUndefined();
  });

  it("never names a Secondary when nothing was scored", () => {
    const { primary, secondary } = deriveResult(scores({}));
    expect(primary).toBeDefined();
    expect(secondary).toBeUndefined();
  });

  it("honors the tunable thresholds as documented", () => {
    expect(SECONDARY_WITHIN).toBe(0.2);
    expect(SECONDARY_LEAD_OVER_THIRD).toBe(0.2);
  });
});
