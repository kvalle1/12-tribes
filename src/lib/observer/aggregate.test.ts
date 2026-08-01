import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers, MIN_OBSERVERS } from "./aggregate";

/** All words that map to a given tribe slug (full coverage → 1.0 for that tribe). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns all twelve tribes in canonical order, even with no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
  });

  it("with a single observer, the average is that observer's own normalized profile", () => {
    const words = wordsForTribe("levi");
    const agg = aggregateObservers([words]);
    expect(agg.observerCount).toBe(1);
    // The average must equal the individually-normalized score tribe-for-tribe.
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
    }
  });

  it("averages individually-normalized profiles with equal weight (not a pooled bag of words)", () => {
    // Observer A fully covers Judah; Observer B fully covers Levi. Each observer's
    // own profile scores their tribe ~1.0. The equal-weight average must put both
    // tribes at ~0.5 — a plain 50/50 of two profiles.
    const agg = aggregateObservers([wordsForTribe("judah"), wordsForTribe("levi")]);
    expect(scoreFor("judah", agg.average)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg.average)).toBeCloseTo(0.5);
  });

  it("does not let an observer who picks more words gain more influence", () => {
    // Judah and Levi have different word counts, so a pooled-words aggregation
    // would tilt toward whichever tribe's observer selected more words. Under
    // equal-weight averaging of normalized profiles, two full-coverage observers
    // land at exactly the same average regardless of how many words each picked.
    expect(wordsForTribe("judah").length).not.toBe(wordsForTribe("levi").length);
    const agg = aggregateObservers([wordsForTribe("judah"), wordsForTribe("levi")]);
    expect(scoreFor("judah", agg.average)).toBeCloseTo(scoreFor("levi", agg.average));
  });

  it("exposes each observer's own normalized profile for anonymous drill-down", () => {
    const a = wordsForTribe("judah");
    const b = wordsForTribe("levi");
    const agg = aggregateObservers([a, b]);
    expect(agg.perObserver).toHaveLength(2);
    // Order is preserved and each entry equals that observer's standalone score.
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
    // Each drill-down profile is the full canonical twelve.
    for (const obs of agg.perObserver) {
      expect(obs.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
  });

  it("averages three agreeing observers to that shared profile", () => {
    const words = wordsForTribe("levi");
    const agg = aggregateObservers([words, words, words]);
    // Three identical profiles average back to the same profile.
    expect(scoreFor("levi", agg.average)).toBeCloseTo(scoreFor("levi", score(words)));
  });

  it("locks below the observer threshold and unlocks at it", () => {
    const words = wordsForTribe("levi");
    expect(aggregateObservers([]).unlocked).toBe(false);
    expect(aggregateObservers([words]).unlocked).toBe(false);
    expect(aggregateObservers([words, words]).unlocked).toBe(false);

    const atThreshold = aggregateObservers(Array(MIN_OBSERVERS).fill(words));
    expect(atThreshold.observerCount).toBe(MIN_OBSERVERS);
    expect(atThreshold.unlocked).toBe(true);

    expect(aggregateObservers(Array(MIN_OBSERVERS + 1).fill(words)).unlocked).toBe(true);
  });

  it("keeps every averaged score within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    for (const s of agg.average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});
