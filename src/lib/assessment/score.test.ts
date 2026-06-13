import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "./words";
import {
  score,
  deriveResult,
  SECONDARY_NEAR_PRIMARY_RATIO,
  type TribeScore,
} from "./score";

/** All adjectives that map to a given tribe slug. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

function scoreFor(slug: string, scores: TribeScore[]): number {
  return scores.find((s) => s.slug === slug)!.score;
}

describe("score", () => {
  it("returns a score for all 12 tribes in tribes order", () => {
    const result = score([]);
    expect(result.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(result.every((s) => s.score === 0)).toBe(true);
  });

  it("normalizes a fully-covered tribe to 1.0", () => {
    // Selecting every word that maps to Levi earns all of Levi's available points.
    const result = score(wordsForTribe("levi"));
    expect(scoreFor("levi", result)).toBeCloseTo(1);
  });

  it("splits a shared word 0.5/0.5 — half of what a solo word contributes", () => {
    // "Courageous" is a Judah-only word (1.0); "Bold" is shared Judah+Reuben (0.5).
    const solo = scoreFor("judah", score(["Courageous"]));
    const shared = scoreFor("judah", score(["Bold"]));
    expect(shared).toBeCloseTo(solo / 2);

    // The other half of "Bold" lands on Reuben, normalized by Reuben's own total.
    const reubenSolo = scoreFor("reuben", score(["Energetic"]));
    const reubenShared = scoreFor("reuben", score(["Bold"]));
    expect(reubenShared).toBeCloseTo(reubenSolo / 2);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // One solo word for a small-coverage tribe (Levi) is worth a larger fraction
    // than one solo word for a high-coverage tribe (Issachar).
    const levi = scoreFor("levi", score(["Dedicated"]));
    const issachar = scoreFor("issachar", score(["Analytical"]));
    expect(levi).toBeGreaterThan(issachar);
  });

  it("ignores unknown words and counts duplicates once", () => {
    const clean = score(["Courageous"]);
    const noisy = score(["Courageous", "Courageous", "NotAWord"]);
    expect(noisy).toEqual(clean);
  });
});

describe("deriveResult", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult([
      { slug: "judah", score: 0.4 },
      { slug: "levi", score: 0.2 },
    ]);
    expect(result.primary.slug).toBe("judah");
  });

  it("returns a Secondary when it is near the Primary and clear of the third", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.9 },
      { slug: "dan", score: 0.5 },
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.5 },
      { slug: "dan", score: 0.1 },
    ]);
    // 0.5 < 0.8 * 1.0, so no Secondary.
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.85 },
      { slug: "dan", score: 0.8 },
    ]);
    // Levi is near Judah, but Dan is not clearly behind Levi — suppress.
    expect(result.secondary).toBeUndefined();
  });

  it("breaks ties deterministically by tribe number", () => {
    // Levi (#2) listed first but Judah (#1) should win the tie for Primary.
    const result = deriveResult([
      { slug: "levi", score: 0.5 },
      { slug: "judah", score: 0.5 },
    ]);
    expect(result.primary.slug).toBe("judah");
  });

  it("names no Secondary when everything scores zero", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("exposes a tunable near-primary threshold", () => {
    expect(SECONDARY_NEAR_PRIMARY_RATIO).toBeGreaterThan(0);
    expect(SECONDARY_NEAR_PRIMARY_RATIO).toBeLessThanOrEqual(1);
  });
});
