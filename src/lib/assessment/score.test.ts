import { describe, expect, it } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import {
  deriveResult,
  score,
  type TribeScore,
} from "./score";

/** Look up one tribe's score from a result set. */
function scoreFor(scores: TribeScore[], slug: string): TribeScore {
  const found = scores.find((s) => s.slug === slug);
  if (!found) throw new Error(`no score for ${slug}`);
  return found;
}

/** Every word currently mapped to a given tribe. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

/** Build a synthetic TribeScore for testing deriveResult's behavior directly. */
function ts(slug: string, score: number): TribeScore {
  return { slug, score, raw: score, available: 1 };
}

describe("score", () => {
  it("returns a score for all 12 tribes", () => {
    const result = score(["Courageous"]);
    expect(result).toHaveLength(tribes.length);
    expect(new Set(result.map((s) => s.slug))).toEqual(
      new Set(tribes.map((t) => t.slug)),
    );
  });

  it("gives a sole-tribe word a full raw point to its tribe", () => {
    const result = score(["Courageous"]);
    expect(scoreFor(result, "judah").raw).toBe(1);
  });

  it("splits a shared word 0.5 to each of its two tribes", () => {
    const result = score(["Bold"]); // Judah · Reuben
    expect(scoreFor(result, "judah").raw).toBe(0.5);
    expect(scoreFor(result, "reuben").raw).toBe(0.5);
  });

  it("splits a three-tribe shared word 0.5 to each", () => {
    const result = score(["Zealous"]); // Judah · Benjamin · Simeon
    expect(scoreFor(result, "judah").raw).toBe(0.5);
    expect(scoreFor(result, "benjamin").raw).toBe(0.5);
    expect(scoreFor(result, "simeon").raw).toBe(0.5);
  });

  it("ignores unknown words", () => {
    const result = score(["Flibbertigibbet"]);
    expect(result.every((s) => s.raw === 0)).toBe(true);
  });

  it("normalizes by each tribe's available points so coverage differences are fair", () => {
    // Levi (6 words) and Dan (11 words) both reach a perfect 1.0 when every one
    // of their words is selected, despite very different word counts.
    const leviWords = wordsForTribe("levi");
    const danWords = wordsForTribe("dan");
    expect(leviWords.length).not.toBe(danWords.length);

    expect(scoreFor(score(leviWords), "levi").score).toBe(1);
    expect(scoreFor(score(danWords), "dan").score).toBe(1);
  });

  it("keeps every normalized score within 0..1", () => {
    const result = score(words.map((w) => w.word)); // select everything
    for (const s of result) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("deriveResult", () => {
  it("always returns a Primary (the highest score), even unsorted", () => {
    const { primary } = deriveResult([
      ts("issachar", 0.3),
      ts("judah", 0.9),
      ts("levi", 0.5),
    ]);
    expect(primary.slug).toBe("judah");
  });

  it("returns a Primary and no Secondary for an empty selection", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("shows a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult([
      ts("judah", 1.0),
      ts("levi", 0.9),
      ts("issachar", 0.5),
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult([
      ts("judah", 1.0),
      ts("levi", 0.5),
      ts("issachar", 0.1),
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult([
      ts("judah", 1.0),
      ts("levi", 0.9),
      ts("issachar", 0.88),
    ]);
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });
});
