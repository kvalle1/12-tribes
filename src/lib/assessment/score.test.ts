import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { words } from "./words";
import { score, deriveResult, type TribeScore } from "./score";

/** All words from the list that map to the given tribe slug. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

function scoreFor(selected: string[], slug: string): number {
  const s = score(selected).find((t) => t.slug === slug);
  if (!s) throw new Error(`no score for ${slug}`);
  return s.score;
}

function mk(pairs: Array<[string, number]>): TribeScore[] {
  return pairs.map(([slug, value]) => ({ slug, score: value }));
}

describe("score", () => {
  it("returns one normalized 0-1 value for every tribe", () => {
    const result = score(["Honorable", "Courageous", "Wise"]);
    expect(result).toHaveLength(tribes.length);
    for (const t of result) {
      expect(t.score).toBeGreaterThanOrEqual(0);
      expect(t.score).toBeLessThanOrEqual(1);
    }
  });

  it("gives a solo word full weight to its single tribe", () => {
    // 'Energetic' maps only to Reuben.
    expect(scoreFor(["Energetic"], "reuben")).toBeGreaterThan(0);
  });

  it("splits a two-way shared word as 0.5 to each tribe", () => {
    // 'Bold' -> judah + reuben; 'Energetic' -> reuben only.
    // Reuben's credit from the shared word should be exactly half a solo word.
    const solo = scoreFor(["Energetic"], "reuben");
    const shared = scoreFor(["Bold"], "reuben");
    expect(shared).toBeCloseTo(solo / 2);
    // The other half lands on Judah.
    expect(scoreFor(["Bold"], "judah")).toBeGreaterThan(0);
  });

  it("splits a three-way shared word as 1/3 to each tribe", () => {
    // 'Zealous' -> judah + benjamin + simeon; 'Honorable' -> judah only.
    const solo = scoreFor(["Honorable"], "judah");
    const shared = scoreFor(["Zealous"], "judah");
    expect(shared).toBeCloseTo(solo / 3);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Levi (6 mapped words) and Dan (many mapped words) both reach exactly 1.0
    // when all of their words are selected — coverage doesn't advantage either.
    expect(scoreFor(wordsForTribe("levi"), "levi")).toBeCloseTo(1);
    expect(scoreFor(wordsForTribe("dan"), "dan")).toBeCloseTo(1);
  });

  it("scores 0 for a tribe whose words were not selected", () => {
    expect(scoreFor(["Honorable"], "asher")).toBe(0);
  });

  it("ignores unknown or duplicate selected words", () => {
    const once = scoreFor(["Honorable"], "judah");
    expect(scoreFor(["Honorable", "Honorable", "not-a-word"], "judah")).toBe(once);
  });

  it("picks the resonant primary from a real selection", () => {
    const judahWords = ["Authoritative", "Courageous", "Honorable", "Sacrificial"];
    const result = deriveResult(score(judahWords));
    expect(result.primary).toBe("judah");
  });
});

describe("deriveResult", () => {
  it("always names a primary (the highest score)", () => {
    const result = deriveResult(mk([
      ["judah", 0.4],
      ["levi", 0.1],
      ["dan", 0.2],
    ]));
    expect(result.primary).toBe("judah");
  });

  it("ranks regardless of input order", () => {
    const result = deriveResult(mk([
      ["levi", 0.1],
      ["dan", 0.2],
      ["judah", 0.9],
    ]));
    expect(result.primary).toBe("judah");
  });

  it("shows a secondary when it is near the primary and clearly ahead of the third", () => {
    const result = deriveResult(mk([
      ["judah", 1.0],
      ["levi", 0.9],
      ["dan", 0.5],
    ]));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("levi");
  });

  it("hides the secondary when it is far behind the primary", () => {
    const result = deriveResult(mk([
      ["judah", 1.0],
      ["levi", 0.5],
      ["dan", 0.4],
    ]));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("hides the secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(mk([
      ["judah", 1.0],
      ["levi", 0.85],
      ["dan", 0.84],
    ]));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });
});
