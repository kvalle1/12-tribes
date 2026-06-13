import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { deriveResult, score, type TribeScore } from "./score";

/** Convenience: turn a TribeScore[] into a slug→score lookup. */
function bySlug(scores: TribeScore[]): Record<string, number> {
  return Object.fromEntries(scores.map((s) => [s.slug, s.score]));
}

describe("score", () => {
  it("returns a score for every tribe, all 0 for an empty selection", () => {
    const scores = score([]);
    expect(scores.length).toBe(tribes.length);
    expect(scores.every((s) => s.score === 0)).toBe(true);
  });

  it("returns normalized 0–1 values", () => {
    const scores = score(["Bold", "Cunning", "Wise", "Generous"]);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Generous" is shared zebulun + asher (0.5 each). Zebulun has 4.5 points
    // available across the list, Asher has 7.
    const scores = bySlug(score(["Generous"]));
    expect(scores.zebulun).toBeCloseTo(0.5 / 4.5);
    expect(scores.asher).toBeCloseTo(0.5 / 7);
    // No other tribe scores from this single shared word.
    const nonzero = score(["Generous"]).filter((s) => s.score > 0).map((s) => s.slug);
    expect(nonzero.sort()).toEqual(["asher", "zebulun"]);
  });

  it("treats a solo word as twice the contribution of a shared word in the same tribe", () => {
    // "Insightful" is solo issachar (1.0); "Cautious" is shared dan+issachar (0.5).
    // Same denominator, so the solo word is worth exactly double.
    const solo = bySlug(score(["Insightful"])).issachar;
    const shared = bySlug(score(["Cautious"])).issachar;
    expect(solo).toBeCloseTo(2 * shared);
  });

  it("normalizes by each tribe's coverage so big and small tribes compete fairly", () => {
    // Fully matching the 6-point Naphtali (all solo words) yields 1.0 — the same
    // ceiling as any other tribe — even though other tribes have more words.
    const allNaphtali = [
      "Creative",
      "Expressive",
      "Free-spirited",
      "Graceful",
      "Healing",
      "Inspiring",
    ];
    expect(bySlug(score(allNaphtali)).naphtali).toBeCloseTo(1);

    // A single solo word is worth more in a low-coverage tribe than in a
    // high-coverage one — coverage size does not structurally favor big tribes.
    const reuben = bySlug(score(["Energetic"])).reuben; // reuben: 4.5 pts
    const issachar = bySlug(score(["Insightful"])).issachar; // issachar: 8.5 pts
    expect(reuben).toBeGreaterThan(issachar);
  });

  it("ignores unknown and duplicate words", () => {
    const once = bySlug(score(["Insightful"])).issachar;
    const dupedAndJunk = bySlug(
      score(["Insightful", "Insightful", "NotAWord"]),
    ).issachar;
    expect(dupedAndJunk).toBeCloseTo(once);
  });
});

describe("deriveResult", () => {
  // Build a full 12-tribe score array from a few overrides; the rest score 0.
  function scoresWith(overrides: Record<string, number>): TribeScore[] {
    return tribes.map((t) => ({ slug: t.slug, score: overrides[t.slug] ?? 0 }));
  }

  it("always returns the highest-scoring tribe as Primary", () => {
    const result = deriveResult(scoresWith({ judah: 0.9, levi: 0.4 }));
    expect(result.primary).toBe("judah");
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, levi: 0.9, dan: 0.5 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("levi");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, levi: 0.5, dan: 0.3 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is roughly tied with the third tribe", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, levi: 0.85, dan: 0.84 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("names only a Primary when no other tribe scores", () => {
    const result = deriveResult(scoresWith({ judah: 0.7 }));
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });
});
