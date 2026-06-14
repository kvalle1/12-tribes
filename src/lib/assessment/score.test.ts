import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "@/lib/assessment/words";
import {
  type TribeScore,
  deriveResult,
  score,
} from "@/lib/assessment/score";

function scoreFor(slug: string, scores: TribeScore[]): number {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found.score;
}

/** Every word that maps to the given tribe slug. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

describe("score", () => {
  it("returns a normalized 0–1 score for all 12 tribes", () => {
    const scores = score(["Authoritative", "Courageous"]);
    expect(scores).toHaveLength(tribes.length);
    for (const { score: value } of scores) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("gives every tribe a score of 0 for an empty selection", () => {
    for (const { score: value } of score([])) {
      expect(value).toBe(0);
    }
  });

  it("counts a shared word as half the weight of a solo word", () => {
    // Both words map to Judah; normalized by the same Judah denominator, so the
    // shared word ('Bold' → Judah·Reuben) contributes exactly half of a solo
    // word ('Authoritative' → Judah).
    const solo = scoreFor("judah", score(["Authoritative"]));
    const shared = scoreFor("judah", score(["Bold"]));
    expect(shared).toBeCloseTo(solo / 2);
  });

  it("splits a shared word's points evenly across its tribes", () => {
    // 'Generous' → Zebulun · Asher contributes 0.5 to each.
    const scores = score(["Generous"]);
    expect(scoreFor("zebulun", scores)).toBeGreaterThan(0);
    expect(scoreFor("asher", scores)).toBeGreaterThan(0);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi has 6 words; Issachar has many more. Selecting *all* of a tribe's
    // words yields a normalized score of exactly 1 regardless of word count,
    // so a low-coverage tribe is not disadvantaged against a high-coverage one.
    expect(scoreFor("levi", score(wordsForTribe("levi")))).toBeCloseTo(1);
    expect(scoreFor("issachar", score(wordsForTribe("issachar")))).toBeCloseTo(
      1,
    );
  });

  it("ignores unknown words and counts duplicates once", () => {
    const base = score(["Authoritative"]);
    const noisy = score(["Authoritative", "Authoritative", "NotAWord"]);
    expect(scoreFor("judah", noisy)).toBeCloseTo(scoreFor("judah", base));
  });
});

describe("deriveResult", () => {
  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult([
      { slug: "judah", score: 0.9 },
      { slug: "levi", score: 0.4 },
      { slug: "dan", score: 0.2 },
    ]);
    expect(result.primary).toBe("judah");
  });

  it("still returns a Primary when every score is 0", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("returns a Secondary when it is near Primary and clear of the third", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.9 },
      { slug: "dan", score: 0.5 },
    ]);
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.5 },
      { slug: "dan", score: 0.4 },
    ]);
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      { slug: "judah", score: 1.0 },
      { slug: "levi", score: 0.9 },
      { slug: "dan", score: 0.85 },
    ]);
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("breaks score ties deterministically by tribe order", () => {
    // Judah (#1) precedes Levi (#2); equal scores must rank Judah first.
    const result = deriveResult([
      { slug: "levi", score: 0.5 },
      { slug: "judah", score: 0.5 },
      { slug: "dan", score: 0.1 },
    ]);
    expect(result.primary).toBe("judah");
  });
});
