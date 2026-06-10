import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import {
  score,
  deriveResult,
  type TribeScore,
} from "./score";

/** All words mapped to a given tribe slug, straight from the data. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

function bySlug(scores: TribeScore[], slug: string): TribeScore {
  const found = scores.find((s) => s.tribeSlug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found;
}

/** Build a synthetic, descending-sorted score list for deriveResult tests. */
function scoresFrom(values: Record<string, number>): TribeScore[] {
  return Object.entries(values)
    .map(([tribeSlug, score]) => ({ tribeSlug, earned: score, available: 1, score }))
    .sort((a, b) => b.score - a.score);
}

describe("score()", () => {
  it("returns one entry per tribe", () => {
    const result = score([]);
    expect(result.length).toBe(tribes.length);
  });

  it("gives a single-tribe word the full weight of 1.0", () => {
    // "Authoritative" maps to Judah only.
    const result = score(["Authoritative"]);
    expect(bySlug(result, "judah").earned).toBeCloseTo(1.0);
  });

  it("splits a shared word as 0.5 to each of its tribes", () => {
    // "Bold" maps to Judah and Reuben.
    const result = score(["Bold"]);
    expect(bySlug(result, "judah").earned).toBeCloseTo(0.5);
    expect(bySlug(result, "reuben").earned).toBeCloseTo(0.5);
  });

  it("gives 0.5 to each tribe of a three-way shared word", () => {
    // "Zealous" maps to Judah, Benjamin, and Simeon.
    const result = score(["Zealous"]);
    expect(bySlug(result, "judah").earned).toBeCloseTo(0.5);
    expect(bySlug(result, "benjamin").earned).toBeCloseTo(0.5);
    expect(bySlug(result, "simeon").earned).toBeCloseTo(0.5);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi is a 6-word tribe, Dan an 11-word tribe. Selecting every word that
    // touches a tribe must yield a normalized 1.0 for that tribe regardless of
    // how many words it has.
    const levi = bySlug(score(wordsForTribe("levi")), "levi");
    const dan = bySlug(score(wordsForTribe("dan")), "dan");
    expect(levi.score).toBeCloseTo(1.0);
    expect(dan.score).toBeCloseTo(1.0);
  });

  it("returns scores between 0 and 1, sorted descending", () => {
    const result = score(["Authoritative", "Bold", "Courageous"]);
    for (const s of result) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
    const sorted = [...result].sort((a, b) => b.score - a.score);
    expect(result).toEqual(sorted);
  });
});

describe("deriveResult()", () => {
  it("always names a Primary as the highest score", () => {
    const result = deriveResult(scoresFrom({ judah: 0.9, dan: 0.4, levi: 0.2 }));
    expect(result.primary.tribeSlug).toBe("judah");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult(scoresFrom({ judah: 1.0, dan: 0.9, levi: 0.5 }));
    expect(result.secondary?.tribeSlug).toBe("dan");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(scoresFrom({ judah: 1.0, dan: 0.5, levi: 0.4 }));
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(scoresFrom({ judah: 1.0, dan: 0.85, levi: 0.84 }));
    expect(result.secondary).toBeUndefined();
  });

  it("never reports a Secondary when nothing scored", () => {
    const result = deriveResult(scoresFrom({ judah: 0, dan: 0, levi: 0 }));
    expect(result.secondary).toBeUndefined();
  });
});
