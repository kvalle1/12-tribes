import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  deriveResult,
  score,
  type TribeScore,
} from "./score";

/** Pull a single tribe's normalized score out of a `score()` result. */
function scoreFor(scores: TribeScore[], slug: string): number {
  return scores.find((entry) => entry.slug === slug)?.score ?? Number.NaN;
}

describe("score", () => {
  it("returns a normalized 0–1 entry for every tribe", () => {
    const scores = score(["Aggressive"]);
    expect(scores).toHaveLength(tribes.length);
    for (const { score: value } of scores) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("scores a solo word as a full point over the tribe's available points", () => {
    // "Aggressive" is Benjamin-only; Benjamin's available points total 6.5.
    expect(scoreFor(score(["Aggressive"]), "benjamin")).toBeCloseTo(1 / 6.5);
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Generous" → Zebulun (available 4.5) + Asher (available 7.0), 0.5 each.
    const scores = score(["Generous"]);
    expect(scoreFor(scores, "zebulun")).toBeCloseTo(0.5 / 4.5);
    expect(scoreFor(scores, "asher")).toBeCloseTo(0.5 / 7.0);
    // Unselected tribes stay at zero.
    expect(scoreFor(scores, "judah")).toBe(0);
  });

  it("splits the three-way shared word 0.5 to each of its three tribes", () => {
    const scores = score(["Zealous"]);
    expect(scoreFor(scores, "judah")).toBeCloseTo(0.5 / 6.5);
    expect(scoreFor(scores, "benjamin")).toBeCloseTo(0.5 / 6.5);
    expect(scoreFor(scores, "simeon")).toBeCloseTo(0.5 / 6.0);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // Both words earn one raw point, but Reuben (available 4.5) covers fewer
    // words than Dan (available 8.0), so the same raw point scores higher.
    const scores = score(["Alert", "Energetic"]); // Dan solo, Reuben solo
    expect(scoreFor(scores, "dan")).toBeCloseTo(1 / 8.0);
    expect(scoreFor(scores, "reuben")).toBeCloseTo(1 / 4.5);
    expect(scoreFor(scores, "reuben")).toBeGreaterThan(scoreFor(scores, "dan"));
  });

  it("counts a duplicated selection once and ignores unknown words", () => {
    const once = scoreFor(score(["Aggressive"]), "benjamin");
    const twice = scoreFor(score(["Aggressive", "Aggressive"]), "benjamin");
    expect(twice).toBe(once);
    expect(scoreFor(score(["Aggressive", "Nonexistent"]), "benjamin")).toBe(once);
  });
});

describe("deriveResult", () => {
  /** Build a full 12-tribe score list, overriding the given slugs. */
  function scoresWith(overrides: Record<string, number>): TribeScore[] {
    return tribes.map((tribe) => ({
      slug: tribe.slug,
      score: overrides[tribe.slug] ?? 0,
    }));
  }

  it("always names a Primary (the highest score)", () => {
    const result = deriveResult(scoresWith({ dan: 0.6, judah: 0.9 }));
    expect(result.primary.slug).toBe("judah");
  });

  it("returns a Secondary when it is near Primary and clear of the third", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, benjamin: 0.9, dan: 0.5 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when it is far behind Primary", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, benjamin: 0.5, dan: 0.4 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scoresWith({ judah: 1.0, benjamin: 0.85, dan: 0.84 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("names a Primary alone when nothing was selected (all zero)", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeDefined();
    expect(result.secondary).toBeUndefined();
  });

  it("works end to end from selected words to Primary + Secondary", () => {
    const result = deriveResult(
      score([
        // All six Naphtali words → naphtali = 1.0
        "Creative",
        "Expressive",
        "Free-spirited",
        "Graceful",
        "Healing",
        "Inspiring",
        // Four solo Zebulun words → zebulun = 4/4.5 ≈ 0.89
        "Enterprising",
        "Expansive",
        "Prosperous",
        "Resourceful",
      ]),
    );
    expect(result.primary.slug).toBe("naphtali");
    expect(result.secondary?.slug).toBe("zebulun");
  });
});
