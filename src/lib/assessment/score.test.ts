import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "./words";
import {
  score,
  deriveResult,
  availablePointsByTribe,
  type TribeScore,
} from "./score";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** Build a synthetic score table for deriveResult tests. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("score", () => {
  it("returns a normalized score for every one of the 12 tribes", () => {
    const scores = score([]);
    expect(scores).toHaveLength(12);
    expect(scores.every((s) => s.score === 0)).toBe(true);
  });

  it("gives a solo word a full point to its single tribe", () => {
    // "Honorable" → Judah only.
    const judah = scoreFor("judah", score(["Honorable"]));
    expect(judah * availablePointsByTribe.judah).toBeCloseTo(1);
  });

  it("splits a shared word as 0.5 to each of its tribes", () => {
    // "Bold" → Judah · Reuben (shared).
    const scores = score(["Bold"]);
    expect(scoreFor("judah", scores) * availablePointsByTribe.judah).toBeCloseTo(
      0.5,
    );
    expect(
      scoreFor("reuben", scores) * availablePointsByTribe.reuben,
    ).toBeCloseTo(0.5);
  });

  it("splits a three-tribe shared word 0.5 to each tribe", () => {
    // "Zealous" → Judah · Benjamin · Simeon.
    const scores = score(["Zealous"]);
    for (const slug of ["judah", "benjamin", "simeon"]) {
      expect(scoreFor(slug, scores) * availablePointsByTribe[slug]).toBeCloseTo(
        0.5,
      );
    }
  });

  it("normalizes by available points so low- and high-coverage tribes compete fairly", () => {
    // Selecting every word that maps to a tribe should score it a perfect 1.0,
    // whether that tribe has few words (Levi) or many (Issachar).
    const allWordsFor = (slug: string) =>
      words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

    const leviScore = scoreFor("levi", score(allWordsFor("levi")));
    const issacharScore = scoreFor("issachar", score(allWordsFor("issachar")));

    expect(leviScore).toBeCloseTo(1);
    expect(issacharScore).toBeCloseTo(1);
  });

  it("ignores duplicate selections (a selection is a set)", () => {
    const once = scoreFor("judah", score(["Honorable"]));
    const twice = scoreFor("judah", score(["Honorable", "Honorable"]));
    expect(twice).toBeCloseTo(once);
  });

  it("ignores words that are not in the list", () => {
    const scores = score(["NotAWord"]);
    expect(scores).toHaveLength(12);
    expect(scores.every((s) => s.score === 0)).toBe(true);
  });

  it("has positive available points for all 12 tribes (normalization never divides by zero)", () => {
    expect(Object.keys(availablePointsByTribe)).toHaveLength(12);
    for (const tribe of tribes) {
      expect(availablePointsByTribe[tribe.slug]).toBeGreaterThan(0);
    }
  });
});

describe("deriveResult", () => {
  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(tableFrom({ judah: 0.8, levi: 0.3 }));
    expect(result.primary.slug).toBe("judah");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      tableFrom({ judah: 1.0, levi: 0.9, dan: 0.2 }),
    );
    expect(result.secondary?.slug).toBe("levi");
  });

  it("hides the Secondary when it is far behind Primary", () => {
    const result = deriveResult(
      tableFrom({ judah: 1.0, levi: 0.5, dan: 0.1 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      tableFrom({ judah: 1.0, levi: 0.9, dan: 0.88 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("returns Primary-only when only one tribe scored", () => {
    const result = deriveResult(tableFrom({ judah: 0.6 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("shows a near Secondary when no third tribe scored", () => {
    const result = deriveResult(tableFrom({ judah: 1.0, levi: 0.9 }));
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("levi");
  });
});

describe("score → deriveResult (end to end)", () => {
  it("names the dominant tribe Primary from a realistic selection", () => {
    // A spread of Judah-leaning words, all solo-mapped to Judah.
    const result = deriveResult(
      score(["Authoritative", "Courageous", "Honorable", "Sacrificial"]),
    );
    expect(result.primary.slug).toBe("judah");
  });
});
