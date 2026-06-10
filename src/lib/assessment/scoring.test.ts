import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "./words";
import { score, deriveResult, type TribeScores } from "./scoring";

/** All words in the list that score toward the given tribe slug. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

describe("score()", () => {
  it("returns a value in [0, 1] for every tribe", () => {
    const scores = score(["Bold", "Courageous", "Wise"]);
    expect(Object.keys(scores).sort()).toEqual(
      tribes.map((t) => t.slug).sort(),
    );
    for (const value of Object.values(scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("scores all zeros for an empty selection", () => {
    const scores = score([]);
    for (const value of Object.values(scores)) expect(value).toBe(0);
  });

  it("splits a two-tribe shared word 0.5 each: a solo word is worth twice as much to a tribe", () => {
    // "Courageous" -> judah only (weight 1.0); "Bold" -> judah + reuben (0.5 each).
    const solo = score(["Courageous"]).judah;
    const shared = score(["Bold"]).judah;
    expect(solo).toBeGreaterThan(0);
    expect(solo).toBeCloseTo(shared * 2);
    // The shared word contributes equally to both its tribes (in raw points),
    // so each tribe earns half of what its own solo word would.
    expect(score(["Bold"]).reuben).toBeGreaterThan(0);
  });

  it("splits the lone three-tribe word ('Zealous') 1/3 each", () => {
    // "Zealous" -> judah + benjamin + simeon. A judah solo word is worth 3x.
    const solo = score(["Courageous"]).judah;
    const triple = score(["Zealous"]).judah;
    expect(triple).toBeGreaterThan(0);
    expect(solo).toBeCloseTo(triple * 3);
  });

  it("normalizes by each tribe's available points, so low- and high-coverage tribes compete fairly", () => {
    const leviWords = wordsForTribe("levi");
    const danWords = wordsForTribe("dan");
    // Sanity: the two tribes genuinely differ in coverage.
    expect(danWords.length).toBeGreaterThan(leviWords.length);

    // Selecting all of a tribe's words maxes that tribe at exactly 1.0,
    // regardless of how many words it has.
    expect(score(leviWords).levi).toBeCloseTo(1);
    expect(score(danWords).dan).toBeCloseTo(1);
  });

  it("ignores words not in the list and counts duplicates once", () => {
    const once = score(["Courageous"]).judah;
    expect(score(["Courageous", "Courageous"]).judah).toBeCloseTo(once);
    expect(score(["Courageous", "NotAWord"]).judah).toBeCloseTo(once);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary, even for an all-zero score", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
    // Deterministic tie-break by tribe number → the first tribe.
    expect(result.primary).toBe(tribes[0].slug);
  });

  it("returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(score(wordsForTribe("levi")));
    expect(result.primary).toBe("levi");
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const scores: TribeScores = { judah: 1.0, levi: 0.9, dan: 0.5 };
    const result = deriveResult(scores);
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const scores: TribeScores = { judah: 1.0, levi: 0.5, dan: 0.1 };
    const result = deriveResult(scores);
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is roughly tied with the third tribe", () => {
    const scores: TribeScores = { judah: 1.0, levi: 0.9, dan: 0.85 };
    const result = deriveResult(scores);
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });
});
