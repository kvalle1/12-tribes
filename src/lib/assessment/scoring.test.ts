import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { score, deriveResult, type TribeScores } from "./scoring";

/** Build a full TribeScores (all 12 slugs) with the given overrides. */
function makeScores(overrides: Record<string, number>): TribeScores {
  const base: TribeScores = {};
  for (const t of tribes) base[t.slug] = 0;
  return { ...base, ...overrides };
}

describe("score()", () => {
  it("returns a 0–1 value for every tribe", () => {
    const scores = score(["Authoritative"]);
    expect(Object.keys(scores).sort()).toEqual(
      tribes.map((t) => t.slug).sort(),
    );
    for (const value of Object.values(scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word 0.5 to each tribe", () => {
    // "Authoritative" is Judah-only (weight 1); "Bold" is Judah+Reuben (weight 0.5).
    // The same tribe (Judah) should earn exactly half as much from the shared word.
    const solo = score(["Authoritative"]).judah;
    const shared = score(["Bold"]).judah;
    expect(solo).toBeGreaterThan(0);
    expect(shared).toBeCloseTo(solo / 2);
  });

  it("credits both tribes of a shared word", () => {
    const scores = score(["Bold"]); // Judah · Reuben
    expect(scores.judah).toBeGreaterThan(0);
    expect(scores.reuben).toBeGreaterThan(0);
    // No other tribe should be credited.
    const credited = Object.entries(scores)
      .filter(([, v]) => v > 0)
      .map(([slug]) => slug)
      .sort();
    expect(credited).toEqual(["judah", "reuben"]);
  });

  it("normalizes by coverage so a small-coverage and large-coverage tribe compete fairly", () => {
    // Naphtali has 6 words (all solo); Dan has 11 words. Selecting all of each
    // tribe's words yields a perfect 1.0 for both, regardless of word count.
    const naphtaliWords = [
      "Creative",
      "Expressive",
      "Free-spirited",
      "Graceful",
      "Healing",
      "Inspiring",
    ];
    const danWords = [
      "Alert",
      "Cautious",
      "Cunning",
      "Deliberate",
      "Discerning",
      "Observant",
      "Perceptive",
      "Skeptical",
      "Strategic",
      "Vigilant",
      "Watchful",
    ];
    expect(score(naphtaliWords).naphtali).toBeCloseTo(1);
    expect(score(danWords).dan).toBeCloseTo(1);

    // A single solo word is worth more to the small-coverage tribe than to the
    // large-coverage one — that is the point of normalization.
    expect(score(["Creative"]).naphtali).toBeGreaterThan(score(["Alert"]).dan);
  });

  it("ignores unknown selected words", () => {
    const scores = score(["Authoritative", "DefinitelyNotAWord"]);
    expect(scores.judah).toBeCloseTo(score(["Authoritative"]).judah);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary, even when nothing scores", () => {
    const result = deriveResult(makeScores({}));
    expect(result.primary).toBeTruthy();
    expect(tribes.some((t) => t.slug === result.primary)).toBe(true);
    expect(result.secondary).toBeNull();
  });

  it("picks the highest-scoring tribe as Primary", () => {
    const result = deriveResult(makeScores({ dan: 0.3, judah: 0.9 }));
    expect(result.primary).toBe("judah");
  });

  it("returns a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, reuben: 0.9, dan: 0.2 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("reuben");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, reuben: 0.5, dan: 0.2 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, reuben: 0.9, dan: 0.85 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });
});
