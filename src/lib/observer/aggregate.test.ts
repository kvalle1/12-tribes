import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
  type ObserverResponseInput,
} from "./aggregate";

/** All words that map to a given tribe slug (same helper the scoring tests use). */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const responsesOf = (...wordLists: string[][]): ObserverResponseInput[] =>
  wordLists.map((words) => ({ words }));

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 others profile for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers(
      responsesOf(wordsForTribe("levi"), wordsForTribe("judah")),
    );
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("reports the number of observers aggregated", () => {
    const agg = aggregateObservers(
      responsesOf(wordsForTribe("levi"), wordsForTribe("judah"), wordsForTribe("dan")),
    );
    expect(agg.observerCount).toBe(3);
  });

  it("weights every observer equally regardless of how many words they picked", () => {
    // Levi has 6 words, Issachar 10. One observer describes a pure-Levi person
    // (6 words → levi 1.0), another a pure-Issachar person (10 words → issachar
    // 1.0). Equal-weight aggregation averages each observer's *normalized*
    // profile, so both tribes land at exactly 0.5 — the observer who picked more
    // words gains no extra influence. (A pooled bag of words would skew toward
    // the higher-count observer; this asserts we do NOT do that.)
    const agg = aggregateObservers(
      responsesOf(wordsForTribe("levi"), wordsForTribe("issachar")),
    );
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(
      scoreFor("issachar", agg.others),
    );
  });

  it("mirrors a single observer's own normalized profile", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const agg = aggregateObservers(responsesOf(words));
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.others)).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
    }
  });

  it("averages, so a tribe two observers agree on outscores one only half agree on", () => {
    // Both observers score levi fully; only one scores judah. Equal-weight mean:
    // levi = (1 + 1)/2 = 1.0, judah = (1 + 0)/2 = 0.5.
    const agg = aggregateObservers(
      responsesOf(wordsForTribe("levi"), [
        ...wordsForTribe("levi"),
        ...wordsForTribe("judah"),
      ]),
    );
    expect(scoreFor("levi", agg.others)).toBeCloseTo(1.0);
    expect(scoreFor("judah", agg.others)).toBeCloseTo(0.5);
  });

  it("exposes each observer's individual profile for anonymous drill-down", () => {
    const agg = aggregateObservers(
      responsesOf(wordsForTribe("levi"), wordsForTribe("judah")),
    );
    expect(agg.perObserver).toHaveLength(2);
    // Each drill-down profile is a full canonical-order score table…
    for (const profile of agg.perObserver) {
      expect(profile.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
      // …and carries no observer identity — only slug/name/score fields.
      for (const row of profile) {
        expect(Object.keys(row).sort()).toEqual(["name", "score", "slug"]);
      }
    }
    expect(scoreFor("levi", agg.perObserver[0])).toBeCloseTo(1.0);
    expect(scoreFor("judah", agg.perObserver[1])).toBeCloseTo(1.0);
  });

  it("handles no observers as an all-zero others profile", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });
});

describe("isReportUnlocked", () => {
  it("locks the report below the 3-observer threshold", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
  });

  it("unlocks the report at or above the threshold", () => {
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(5)).toBe(true);
  });
});
