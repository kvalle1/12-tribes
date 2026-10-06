import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isComparisonUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug (drawn from the live word list). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a zeroed 12-tribe profile and count 0 for no responses", () => {
    const profile = aggregateObservers([]);
    expect(profile.observerCount).toBe(0);
    expect(profile.scores).toHaveLength(12);
    expect(profile.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(profile.scores.every((s) => s.score === 0)).toBe(true);
    expect(profile.perObserver).toEqual([]);
  });

  it("scores each observer individually, preserving canonical tribe order", () => {
    const responses = [["Courageous"], wordsForTribe("levi")];
    const profile = aggregateObservers(responses);

    expect(profile.observerCount).toBe(2);
    expect(profile.perObserver).toHaveLength(2);
    for (const obs of profile.perObserver) {
      expect(obs.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Observer 1 is judah-leaning, observer 2 maxes levi.
    expect(scoreFor("judah", profile.perObserver[0])).toBeGreaterThan(0);
    expect(scoreFor("levi", profile.perObserver[1])).toBeCloseTo(1);
  });

  it("returns the equal-weight mean of per-observer normalized scores", () => {
    const responses = [
      ["Courageous", "Honorable"],
      wordsForTribe("levi"),
      ["Wise", "Patient", "Learned"],
    ];
    const profile = aggregateObservers(responses);
    const per = responses.map((r) => score(r));

    // Every tribe's aggregate score is exactly the mean across observers.
    for (const tribe of tribes) {
      const mean =
        per.reduce((sum, obs) => sum + scoreFor(tribe.slug, obs), 0) /
        responses.length;
      expect(scoreFor(tribe.slug, profile.scores)).toBeCloseTo(mean);
    }
  });

  it("is an equal-weight average, NOT a pooled bag of words", () => {
    // One prolific observer (many judah words) and one sparse observer. If the
    // aggregate pooled all words into a single score, the prolific observer's
    // tribe would carry its full pooled weight. Equal-weight averaging instead
    // dilutes each observer's vector by the number of observers, so a voter who
    // picks more words does not gain more influence.
    const prolific = ["Courageous", "Honorable", "Authoritative", "Sacrificial"];
    const sparse = ["Dedicated"];
    const profile = aggregateObservers([prolific, sparse]);

    const pooled = score([...prolific, ...sparse]);

    const aggJudah = scoreFor("judah", profile.scores);
    const pooledJudah = scoreFor("judah", pooled);

    // Pooled would count all four judah words at full strength; the equal-weight
    // average halves the prolific observer's contribution (two observers).
    expect(aggJudah).toBeLessThan(pooledJudah);
    expect(aggJudah).toBeCloseTo(scoreFor("judah", score(prolific)) / 2);
  });

  it("gives each observer one vote regardless of how many words they pick", () => {
    // A prolific observer maxing judah and a sparse observer maxing levi end up
    // with equal aggregate strength — word count does not buy influence.
    const judahMax = wordsForTribe("judah");
    const leviMax = wordsForTribe("levi");
    const profile = aggregateObservers([judahMax, leviMax]);

    expect(scoreFor("judah", score(judahMax))).toBeCloseTo(1);
    expect(scoreFor("levi", score(leviMax))).toBeCloseTo(1);
    // Each maxes their own tribe to 1.0, so the two-observer mean is 0.5 each.
    expect(scoreFor("judah", profile.scores)).toBeCloseTo(0.5);
    expect(scoreFor("levi", profile.scores)).toBeCloseTo(0.5);
  });

  it("keeps per-observer scores anonymous and index-aligned for drill-down", () => {
    const responses = [["Courageous"], ["Dedicated"], ["Wise"]];
    const profile = aggregateObservers(responses);
    expect(profile.perObserver).toHaveLength(3);
    // The shape carries no identity — only slug/name/score per tribe.
    for (const obs of profile.perObserver) {
      for (const s of obs) {
        expect(Object.keys(s).sort()).toEqual(["name", "score", "slug"]);
      }
    }
  });
});

describe("isComparisonUnlocked", () => {
  it("locks the report below the minimum observer threshold", () => {
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
  });

  it("unlocks the report at and above the minimum observer threshold", () => {
    expect(isComparisonUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isComparisonUnlocked(MIN_OBSERVERS_FOR_REPORT + 2)).toBe(true);
  });

  it("requires at least 3 observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
