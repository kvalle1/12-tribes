import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
  type ObserverAggregate,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, agg: ObserverAggregate) =>
  agg.profile.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 profile for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
      wordsForTribe("judah"),
    ]);
    expect(agg.profile).toHaveLength(12);
    expect(agg.profile.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.profile) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("averages per-observer normalized scores equally — not a pooled bag of words", () => {
    // Observer A fully covers Levi, Observer B fully covers Issachar. The
    // equal-weight average is 0.5 for each. Pooling the words instead would score
    // BOTH tribes 1.0, so this asserts we average per-observer profiles.
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg)).toBeCloseTo(0.5);

    // What pooling would have produced, for contrast.
    const pooled = score([...wordsForTribe("levi"), ...wordsForTribe("issachar")]);
    expect(pooled.find((s) => s.slug === "levi")!.score).toBeCloseTo(1);
    expect(pooled.find((s) => s.slug === "issachar")!.score).toBeCloseTo(1);
  });

  it("gives an observer who picks more words no more influence than one who picks fewer", () => {
    // Levi has 6 words, Issachar 10. Observer A fully covers Levi (6 words),
    // Observer B fully covers Issachar (10 words). Each tribe still averages to
    // an equal 0.5 — the Observer who picked more words gains no extra weight
    // (ADR-0003).
    const agg = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", agg)).toBeCloseTo(scoreFor("issachar", agg));
    expect(scoreFor("levi", agg)).toBeCloseTo(0.5);
  });

  it("matches the mean of the individually-scored observers, tribe by tribe", () => {
    const responses = [
      wordsForTribe("levi"),
      ["Courageous", "Bold"],
      wordsForTribe("issachar"),
    ];
    const agg = aggregateObservers(responses);
    const individual = responses.map((r) => score(r));
    for (const tribe of tribes) {
      const mean =
        individual.reduce(
          (sum, s) => sum + s.find((t) => t.slug === tribe.slug)!.score,
          0,
        ) / individual.length;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(mean);
    }
  });

  it("exposes each observer's individual normalized scores for anonymous drill-down", () => {
    const responses = [wordsForTribe("levi"), wordsForTribe("issachar")];
    const agg = aggregateObservers(responses);
    expect(agg.perObserver).toHaveLength(2);
    for (const per of agg.perObserver) {
      expect(per.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Observer 1 is all-Levi; Observer 2 is all-Issachar.
    expect(agg.perObserver[0].find((s) => s.slug === "levi")!.score).toBeCloseTo(1);
    expect(agg.perObserver[1].find((s) => s.slug === "issachar")!.score).toBeCloseTo(1);
  });

  it("reports the observer count and preserves response order for stable numbering", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(agg.observerCount).toBe(3);
    expect(agg.perObserver).toHaveLength(3);
  });

  it("stays locked below the observer threshold and unlocks at it", () => {
    const one = aggregateObservers([wordsForTribe("levi")]);
    expect(one.observerCount).toBe(1);
    expect(one.unlocked).toBe(false);

    const responses = Array.from({ length: MIN_OBSERVERS_FOR_REPORT }, () =>
      wordsForTribe("levi"),
    );
    const atThreshold = aggregateObservers(responses);
    expect(atThreshold.observerCount).toBe(MIN_OBSERVERS_FOR_REPORT);
    expect(atThreshold.unlocked).toBe(true);
  });

  it("handles no observers as an all-zero, locked profile", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.unlocked).toBe(false);
    expect(agg.perObserver).toHaveLength(0);
    expect(agg.profile.every((s) => s.score === 0)).toBe(true);
  });
});
