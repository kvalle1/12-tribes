import { describe, it, expect } from "vitest";
import {
  score,
  deriveResult,
  type TribeScore,
} from "./score";

/** Pick a tribe's score out of the result array. */
function get(scores: TribeScore[], slug: string): TribeScore {
  const s = scores.find((x) => x.slug === slug);
  if (!s) throw new Error(`no score for ${slug}`);
  return s;
}

/** Build a minimal TribeScore for deriveResult tests. */
function s(slug: string, value: number): TribeScore {
  return { slug, points: value, available: 1, score: value };
}

describe("score()", () => {
  it("returns a normalized score for all 12 tribes", () => {
    const scores = score(["Honorable"]);
    expect(scores).toHaveLength(12);
    for (const tribe of scores) {
      expect(tribe.score).toBeGreaterThanOrEqual(0);
      expect(tribe.score).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word as 0.5 of raw points to each of its two tribes", () => {
    const scores = score(["Bold"]); // judah + reuben
    expect(get(scores, "judah").points).toBe(0.5);
    expect(get(scores, "reuben").points).toBe(0.5);
  });

  it("splits the three-tribe word as 0.5 to each tribe", () => {
    const scores = score(["Zealous"]); // judah + benjamin + simeon
    expect(get(scores, "judah").points).toBe(0.5);
    expect(get(scores, "benjamin").points).toBe(0.5);
    expect(get(scores, "simeon").points).toBe(0.5);
  });

  it("scores equals points / available for each tribe", () => {
    const scores = score(["Honorable"]);
    for (const tribe of scores) {
      const expected = tribe.available > 0 ? tribe.points / tribe.available : 0;
      expect(tribe.score).toBeCloseTo(expected, 10);
    }
  });

  it("normalizes by coverage so small- and large-coverage tribes compete fairly", () => {
    // Levi has fewer words than Issachar, so the same single sole-mapped word
    // earns Levi a HIGHER normalized score despite equal raw points.
    const scores = score(["Dedicated", "Analytical"]); // levi sole, issachar sole
    const levi = get(scores, "levi");
    const issachar = get(scores, "issachar");

    expect(levi.points).toBe(1);
    expect(issachar.points).toBe(1);
    expect(levi.available).toBeLessThan(issachar.available);
    expect(levi.score).toBeGreaterThan(issachar.score);
  });

  it("ignores unknown words and counts duplicates once", () => {
    const once = score(["Honorable"]);
    const dupes = score(["Honorable", "Honorable", "NotAWord"]);
    expect(get(dupes, "judah").points).toBe(get(once, "judah").points);
  });

  it("gives an empty selection a zero score everywhere", () => {
    const scores = score([]);
    for (const tribe of scores) expect(tribe.score).toBe(0);
  });
});

describe("deriveResult()", () => {
  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult([s("judah", 0.9), s("levi", 0.3), s("dan", 0.1)]);
    expect(result.primary.slug).toBe("judah");
  });

  it("names a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult([
      s("judah", 1.0),
      s("levi", 0.9), // within 20% of primary
      s("dan", 0.4), // third well behind secondary
    ]);
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      s("judah", 1.0),
      s("levi", 0.5), // 50% behind primary -> not near
      s("dan", 0.1),
    ]);
    expect(result.secondary).toBeUndefined();
    expect(result.primary.slug).toBe("judah");
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      s("judah", 1.0),
      s("levi", 0.9), // near primary...
      s("dan", 0.88), // ...but third is basically tied with secondary
    ]);
    expect(result.secondary).toBeUndefined();
  });

  it("throws on an empty score list", () => {
    expect(() => deriveResult([])).toThrow();
  });
});
