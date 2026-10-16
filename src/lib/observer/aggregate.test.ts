import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("scores all-zero when there are no observer responses", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own normalized score when only one responded", () => {
    const words = [...wordsForTribe("levi").slice(0, 4), "Courageous"];
    const agg = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("returns the arithmetic mean of each observer's normalized scores", () => {
    const a = ["Courageous", "Bold", "Zealous"];
    const b = [...wordsForTribe("issachar").slice(0, 5)];
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expected);
    }
  });

  it("weights each observer equally regardless of how many words they picked", () => {
    // Observer A fully covers Levi (6 words → levi == 1.0 for them).
    // Observer B fully covers Issachar (10 words → issachar == 1.0 for them).
    // Equal-weight averaging gives each tribe half its covering observer's score,
    // so levi and issachar land on the SAME aggregate value even though Issachar
    // was described with more words. A pooled bag-of-words would skew toward the
    // higher-word-count tribe; equal weighting must not.
    const observerLevi = wordsForTribe("levi");
    const observerIssachar = wordsForTribe("issachar");
    const agg = aggregateObservers([observerLevi, observerIssachar]);

    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg)).toBeCloseTo(scoreFor("issachar", agg));
  });

  it("does not behave like a pooled bag of words", () => {
    // Observer A names Judah with a single word; Observer B covers Judah fully
    // (score 1.0 on their own). Pooling the two selections dedupes A's word into
    // B's set, so pooled scoring reads Judah at a full 1.0 — B's lone view drowns
    // out A. Equal-weight aggregation instead averages A's partial read with B's
    // full one, landing strictly below 1.0. The two approaches must differ.
    const a = ["Courageous"]; // one Judah word
    const b = wordsForTribe("judah"); // all Judah words → judah == 1.0 alone
    const equalWeight = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]);

    expect(scoreFor("judah", pooled)).toBeCloseTo(1);
    expect(scoreFor("judah", equalWeight)).toBeLessThan(
      scoreFor("judah", pooled),
    );
  });

  it("ignores unknown words and de-duplicates within an observer (via the scoring core)", () => {
    const clean = aggregateObservers([["Courageous"]]);
    const noisy = aggregateObservers([["Courageous", "Courageous", "notaword"]]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, noisy)).toBeCloseTo(
        scoreFor(tribe.slug, clean),
      );
    }
  });
});

describe("isReportUnlocked", () => {
  it("unlocks at the minimum observer threshold and above", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
    expect(isReportUnlocked(MIN_OBSERVERS_TO_UNLOCK)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_TO_UNLOCK + 5)).toBe(true);
  });

  it("stays locked below the threshold", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_TO_UNLOCK - 1)).toBe(false);
  });
});
