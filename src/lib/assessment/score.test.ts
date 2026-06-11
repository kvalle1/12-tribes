import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { words } from "./words";
import {
  deriveResult,
  score,
  type TribeScore,
  SECONDARY_NEAR_PRIMARY_RATIO,
} from "./score";

/** Convenience: pull a single tribe's normalized score from a score() result. */
function scoreOf(result: TribeScore[], slug: string): number {
  return result.find((s) => s.slug === slug)!.score;
}

/** All words that contribute to a given tribe. */
function wordsForTribe(slug: string): string[] {
  return words.filter((w) => w.tribes.includes(slug)).map((w) => w.word);
}

describe("score", () => {
  it("returns a normalized 0–1 value for every tribe", () => {
    const result = score(["Bold", "Courageous", "Honorable"]);
    expect(result).toHaveLength(tribes.length);
    for (const { score: s } of result) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("gives a shared word half the weight of a solo word for the same tribe", () => {
    // "Authoritative" is solo Judah (weight 1); "Bold" is Judah+Reuben (0.5).
    // The Judah denominator cancels, so the shared word must score exactly half.
    const solo = scoreOf(score(["Authoritative"]), "judah");
    const shared = scoreOf(score(["Bold"]), "judah");
    expect(shared).toBeCloseTo(0.5 * solo);

    // Same on the other side of the share: "Energetic" is solo Reuben.
    const soloReuben = scoreOf(score(["Energetic"]), "reuben");
    const sharedReuben = scoreOf(score(["Bold"]), "reuben");
    expect(sharedReuben).toBeCloseTo(0.5 * soloReuben);
  });

  it("normalizes by coverage so small and large tribes compete fairly", () => {
    // Selecting every word that feeds a tribe yields a full 1.0 for that tribe,
    // regardless of how many words the tribe has.
    const smallTribe = "zebulun"; // few words
    const largeTribe = "issachar"; // many words
    expect(wordsForTribe(smallTribe).length).toBeLessThan(
      wordsForTribe(largeTribe).length,
    );

    expect(scoreOf(score(wordsForTribe(smallTribe)), smallTribe)).toBeCloseTo(1);
    expect(scoreOf(score(wordsForTribe(largeTribe)), largeTribe)).toBeCloseTo(1);
  });

  it("ignores unknown and duplicate selections", () => {
    const once = scoreOf(score(["Courageous"]), "judah");
    const twice = scoreOf(score(["Courageous", "Courageous", "Nonexistent"]), "judah");
    expect(twice).toBeCloseTo(once);
  });
});

describe("deriveResult", () => {
  function makeScores(overrides: Record<string, number>): TribeScore[] {
    return tribes.map((t) => ({ slug: t.slug, score: overrides[t.slug] ?? 0 }));
  }

  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(makeScores({ judah: 0.9, levi: 0.2 }));
    expect(result.primary).toBe("judah");
  });

  it("shows a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, benjamin: 0.9, dan: 0.3 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      makeScores({ judah: 1.0, benjamin: 0.5, dan: 0.2 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    // benjamin is near judah, but dan is right behind benjamin — no clear #2.
    const result = deriveResult(
      makeScores({ judah: 1.0, benjamin: 0.9, dan: 0.88 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("threshold constant governs the near-Primary cutoff", () => {
    // Exactly at the cutoff qualifies (given the third is far behind).
    const atCutoff = SECONDARY_NEAR_PRIMARY_RATIO; // e.g. 0.8
    const result = deriveResult(
      makeScores({ judah: 1.0, benjamin: atCutoff, dan: 0.1 }),
    );
    expect(result.secondary).toBe("benjamin");
  });

  it("throws on empty input", () => {
    expect(() => deriveResult([])).toThrow();
  });
});
