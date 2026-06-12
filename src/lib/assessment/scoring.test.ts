import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import { score, deriveResult, type TribeScores } from "./scoring";

/** All words that map to a given tribe slug. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

/** A full 12-tribe score map with the given overrides; everything else 0. */
function scoresWith(overrides: Record<string, number>): TribeScores {
  const base: TribeScores = {};
  for (const t of tribes) base[t.slug] = 0;
  return { ...base, ...overrides };
}

describe("score", () => {
  it("returns a normalized 0–1 value for every tribe", () => {
    const scores = score(["Bold", "Courageous", "Wise"]);
    expect(Object.keys(scores).sort()).toEqual(
      tribes.map((t) => t.slug).sort(),
    );
    for (const value of Object.values(scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared (two-tribe) word as 0.5 to each tribe", () => {
    // "Authoritative" is Judah-only (1.0); "Bold" is Judah+Reuben (0.5 to Judah).
    // Over Judah's fixed denominator, the solo word must score exactly double.
    const solo = score(["Authoritative"]).judah;
    const shared = score(["Bold"]).judah;
    expect(shared).toBeGreaterThan(0);
    expect(solo).toBeCloseTo(2 * shared, 10);
  });

  it("splits a three-tribe word as 1/3 to each tribe", () => {
    // "Zealous" maps to Judah + Benjamin + Simeon, so Judah earns 1/3 of a solo.
    const solo = score(["Authoritative"]).judah;
    const triple = score(["Zealous"]).judah;
    expect(triple).toBeGreaterThan(0);
    expect(solo).toBeCloseTo(3 * triple, 10);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi has 6 words, Dan has 10 — selecting all of either reaches exactly 1.0.
    expect(score(wordsForTribe("levi")).levi).toBeCloseTo(1, 10);
    expect(score(wordsForTribe("dan")).dan).toBeCloseTo(1, 10);
  });

  it("ignores words that are not in the list", () => {
    const scores = score(["NotARealWord"]);
    for (const value of Object.values(scores)) {
      expect(value).toBe(0);
    }
  });

  it("treats duplicate selections as a single selection", () => {
    expect(score(["Bold", "Bold"]).judah).toBeCloseTo(score(["Bold"]).judah, 10);
  });

  it("returns all zeros for an empty selection", () => {
    const scores = score([]);
    for (const value of Object.values(scores)) {
      expect(value).toBe(0);
    }
  });
});

describe("deriveResult", () => {
  it("always returns a Primary", () => {
    const result = deriveResult(scoresWith({ judah: 0.9, reuben: 0.3 }));
    expect(result.primary).toBe("judah");
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, reuben: 0.9, dan: 0.4 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("reuben");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, reuben: 0.5, dan: 0.4 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, reuben: 0.9, dan: 0.88 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("returns no Secondary when nothing was selected", () => {
    const result = deriveResult(scoresWith({}));
    expect(result.primary).toBeTruthy();
    expect(result.secondary).toBeNull();
  });
});
