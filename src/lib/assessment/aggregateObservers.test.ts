import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  compareProfiles,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns an all-zero others profile and no observers for an empty set", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores each observer individually, preserving canonical tribe order", () => {
    const a = wordsForTribe("levi");
    const b = wordsForTribe("judah");
    const agg = aggregateObservers([a, b]);

    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
    for (const profile of agg.perObserver) {
      expect(profile.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Each per-observer profile matches scoring that observer's words alone.
    expect(scoreFor("levi", agg.perObserver[0])).toBeCloseTo(
      scoreFor("levi", score(a)),
    );
    expect(scoreFor("judah", agg.perObserver[1])).toBeCloseTo(
      scoreFor("judah", score(b)),
    );
  });

  it("averages equal-weight over per-observer NORMALIZED scores, not a pooled bag of words", () => {
    // An observer who picks more words must not gain more influence (ADR-0003).
    // Observer A picks a single Levi word; Observer B picks all of Levi's words.
    const levi = wordsForTribe("levi");
    const light = [levi[0]];
    const heavy = levi;

    const agg = aggregateObservers([light, heavy]);
    const othersLevi = scoreFor("levi", agg.others);

    const lightLevi = scoreFor("levi", score(light));
    const heavyLevi = scoreFor("levi", score(heavy));

    // Equal-weight: the mean of the two individually-normalized Levi scores.
    expect(othersLevi).toBeCloseTo((lightLevi + heavyLevi) / 2);
    // Pooling the words instead would give the full-coverage value (heavyLevi);
    // the light observer drags the average below that, proving equal weighting.
    expect(othersLevi).toBeLessThan(heavyLevi);
  });

  it("gives every observer the same weight regardless of how many words they picked", () => {
    // Two observers, each maxing out a different tribe with a different word
    // count (Issachar has 10 words, Levi has 6). Both peak at 1.0 individually,
    // so the equal-weight average lands each at exactly 0.5 — word count is
    // irrelevant to influence.
    const issacharWords = wordsForTribe("issachar");
    const leviWords = wordsForTribe("levi");
    expect(issacharWords.length).not.toBe(leviWords.length);

    const agg = aggregateObservers([issacharWords, leviWords]);
    expect(scoreFor("issachar", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
  });

  it("averages identical observers back to that same profile", () => {
    const words = wordsForTribe("judah");
    const agg = aggregateObservers([words, words, words]);
    expect(scoreFor("judah", agg.others)).toBeCloseTo(scoreFor("judah", score(words)));
  });
});

describe("isReportUnlocked", () => {
  it("locks below the minimum and unlocks at or above it", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(5)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("pairs self and others per tribe in canonical order with a self-minus-others delta", () => {
    const self = score(wordsForTribe("judah"));
    const others = score(wordsForTribe("levi"));
    const rows = compareProfiles(self, others);

    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));

    const judah = rows.find((r) => r.slug === "judah")!;
    expect(judah.self).toBeCloseTo(scoreFor("judah", self));
    expect(judah.others).toBeCloseTo(scoreFor("judah", others));
    expect(judah.delta).toBeCloseTo(judah.self - judah.others);
    // Self leans Judah, others lean Levi → positive delta on Judah, negative on Levi.
    expect(judah.delta).toBeGreaterThan(0);
    expect(rows.find((r) => r.slug === "levi")!.delta).toBeLessThan(0);
  });
});
