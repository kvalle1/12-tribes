import { describe, it, expect } from "vitest";
import { words } from "./words";
import {
  score,
  deriveResult,
  type TribeScore,
} from "./score";

/** Convenience: collapse a TribeScore[] into a slug→score lookup. */
function bySlug(scores: TribeScore[]): Record<string, number> {
  return Object.fromEntries(scores.map((s) => [s.slug, s.score]));
}

/** All words in the list that map to a given tribe slug. */
function wordsFor(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

describe("score", () => {
  it("returns a normalized 0–1 value for every one of the 12 tribes", () => {
    const scores = score(["Bold"]);
    expect(scores).toHaveLength(12);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives a shared word half the weight a solo word gives the same tribe", () => {
    // "Bold" is shared (judah + reuben); "Authoritative" is a solo Judah word.
    // Both normalize by Judah's denominator, so the shared word must land at
    // exactly half the solo word's normalized score.
    const bold = bySlug(score(["Bold"]));
    const solo = bySlug(score(["Authoritative"]));
    expect(bold.judah).toBeCloseTo(solo.judah / 2);

    // The other half of the shared word lands on Reuben.
    const energetic = bySlug(score(["Energetic"])); // solo Reuben word
    expect(bold.reuben).toBeCloseTo(energetic.reuben / 2);
  });

  it("ignores selected words that aren't in the list", () => {
    expect(score(["NotAWord", "Stillnope"]).every((s) => s.score === 0)).toBe(true);
  });

  it("normalizes by coverage so broad and narrow tribes compete fairly", () => {
    // Naphtali (6 words) and Dan (8 words) have very different coverage, yet
    // selecting *all* of a tribe's words must max it out at 1.0 either way.
    const naphtali = bySlug(score(wordsFor("naphtali")));
    const dan = bySlug(score(wordsFor("dan")));
    expect(naphtali.naphtali).toBeCloseTo(1);
    expect(dan.dan).toBeCloseTo(1);
  });
});

describe("deriveResult", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult([
      { slug: "judah", score: 0.4 },
      { slug: "dan", score: 0.9 },
      { slug: "levi", score: 0.1 },
    ]);
    expect(result.primary.slug).toBe("dan");
  });

  it("shows a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult([
      { slug: "judah", score: 0.9 },
      { slug: "benjamin", score: 0.8 }, // ≥ 80% of Primary
      { slug: "dan", score: 0.3 }, // far below Secondary
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      { slug: "judah", score: 0.9 },
      { slug: "benjamin", score: 0.5 }, // < 80% of Primary
      { slug: "dan", score: 0.2 },
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      { slug: "judah", score: 0.9 },
      { slug: "benjamin", score: 0.8 }, // near Primary...
      { slug: "dan", score: 0.78 }, // ...but the third is right behind it
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("throws on empty input rather than guessing", () => {
    expect(() => deriveResult([])).toThrow();
  });
});
