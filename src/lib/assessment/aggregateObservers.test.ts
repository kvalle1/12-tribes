import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  scoreEachObserver,
  compareProfiles,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: readonly TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Real single-tribe words, so the tests exercise the actual scoring core rather
// than a hand-mocked one. `levi` has five single-tribe words plus one shared.
const LEVI_A = ["Dedicated", "Devoted"]; // both levi
const LEVI_B = ["Dedicated"]; // one levi word, overlapping with A
const JUDAH = ["Authoritative", "Courageous", "Honorable"]; // three judah words

describe("aggregateObservers", () => {
  it("returns a full 12-tribe profile in canonical order", () => {
    const profile = aggregateObservers([LEVI_A, LEVI_B, JUDAH]);
    expect(profile.map((p) => p.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("is the equal-weight average of the per-observer normalized scores", () => {
    // The defining property (ADR-0003): score each observer on its own, then
    // average. Derived from the real core so it survives normalization tuning.
    const responses = [LEVI_A, LEVI_B, JUDAH];
    const perObserver = responses.map((r) => score(r));
    const agg = aggregateObservers(responses);

    for (const tribe of tribes) {
      const expected =
        perObserver.reduce((sum, p) => sum + scoreFor(tribe.slug, p), 0) /
        responses.length;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expected, 12);
    }
  });

  it("is NOT a pooled bag of words (overlapping picks are not collapsed)", () => {
    // Pooling concatenates every observer's words and scores once, which dedupes
    // the shared "Dedicated" and so reads levi higher than the equal-weight
    // average does. The two must differ, proving we don't pool.
    const responses = [LEVI_A, LEVI_B];
    const agg = aggregateObservers(responses);
    const pooled = score([...LEVI_A, ...LEVI_B]);

    expect(scoreFor("levi", agg)).toBeGreaterThan(0);
    expect(scoreFor("levi", agg)).not.toBeCloseTo(scoreFor("levi", pooled), 12);
    // Averaged levi = (2/5.5 + 1/5.5) / 2; pooled levi = 2/5.5.
    expect(scoreFor("levi", agg)).toBeCloseTo(1.5 / 5.5 / 1, 12);
    expect(scoreFor("levi", pooled)).toBeCloseTo(2 / 5.5, 12);
  });

  it("gives a wordier observer no extra influence on a tribe only another picked", () => {
    // One observer floods judah with words; the other picks a single levi word.
    // The averaged levi score depends only on the levi observer, not on how many
    // words the judah observer piled on.
    const withFewWords = aggregateObservers([JUDAH, LEVI_B]);
    const withManyWords = aggregateObservers([
      [...JUDAH, "Sacrificial", "Bold", "Strong", "Fervent"],
      LEVI_B,
    ]);
    expect(scoreFor("levi", withFewWords)).toBeCloseTo(
      scoreFor("levi", score(LEVI_B)) / 2,
      12,
    );
    expect(scoreFor("levi", withManyWords)).toBeCloseTo(
      scoreFor("levi", withFewWords),
      12,
    );
  });

  it("returns all-zero scores when there are no responses", () => {
    const profile = aggregateObservers([]);
    expect(profile.map((p) => p.slug)).toEqual(tribes.map((t) => t.slug));
    expect(profile.every((p) => p.score === 0)).toBe(true);
  });

  it("equals the single observer's own profile when only one responded", () => {
    const agg = aggregateObservers([LEVI_A]);
    const solo = score(LEVI_A);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, solo), 12);
    }
  });
});

describe("scoreEachObserver", () => {
  it("scores each observer independently, preserving order", () => {
    const profiles = scoreEachObserver([LEVI_A, JUDAH]);
    expect(profiles).toHaveLength(2);
    expect(scoreFor("levi", profiles[0])).toBeCloseTo(scoreFor("levi", score(LEVI_A)), 12);
    expect(scoreFor("judah", profiles[1])).toBeCloseTo(scoreFor("judah", score(JUDAH)), 12);
    // Observer 0 picked no judah words; observer 1 picked no levi words.
    expect(scoreFor("judah", profiles[0])).toBe(0);
    expect(scoreFor("levi", profiles[1])).toBe(0);
  });
});

describe("isReportUnlocked", () => {
  it("stays locked below the minimum and unlocks at it", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("carries the signed self-minus-others divergence per tribe", () => {
    const self = score(LEVI_A); // strong levi, zero judah
    const others = aggregateObservers([JUDAH, JUDAH]); // strong judah, zero levi
    const comparison = compareProfiles(self, others);

    const levi = comparison.find((c) => c.slug === "levi")!;
    const judah = comparison.find((c) => c.slug === "judah")!;

    expect(levi.divergence).toBeCloseTo(levi.self - levi.others, 12);
    expect(levi.divergence).toBeGreaterThan(0); // subject reads higher on levi
    expect(judah.divergence).toBeLessThan(0); // others read higher on judah
    expect(comparison.map((c) => c.slug)).toEqual(self.map((s) => s.slug));
  });

  it("treats a tribe missing from the others profile as zero", () => {
    const self = score(LEVI_A);
    const comparison = compareProfiles(self, []);
    const levi = comparison.find((c) => c.slug === "levi")!;
    expect(levi.others).toBe(0);
    expect(levi.divergence).toBeCloseTo(levi.self, 12);
  });
});
