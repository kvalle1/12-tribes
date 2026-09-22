import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  hasEnoughObservers,
  MIN_OBSERVERS,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns all 12 tribes in canonical order", () => {
    const { averaged } = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(averaged.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("is the equal-weight average of each observer's normalized profile", () => {
    const a = ["Courageous"];
    const b = wordsForTribe("levi");
    const { averaged } = aggregateObservers([a, b]);

    const sa = score(a);
    const sb = score(b);
    averaged.forEach((tribe, i) => {
      expect(tribe.score).toBeCloseTo((sa[i].score + sb[i].score) / 2);
    });
  });

  it("gives every observer one vote regardless of how many words they picked (not a pooled bag of words)", () => {
    const onePick = ["Courageous"]; // 1 word → judah only
    const manyPicks = wordsForTribe("levi"); // every levi word → levi = 1.0
    const { averaged } = aggregateObservers([onePick, manyPicks]);

    // Equal weight: judah keeps exactly half its solo strength (one of two votes).
    expect(scoreFor("judah", averaged)).toBeCloseTo(
      scoreFor("judah", score(onePick)) / 2,
    );
    // Pooling all words into one score would instead give the heavy selector
    // more influence, so the equal-weight judah must differ from the pooled one.
    const pooled = score([...onePick, ...manyPicks]);
    expect(scoreFor("judah", averaged)).not.toBeCloseTo(
      scoreFor("judah", pooled),
    );
  });

  it("exposes each observer's own profile in submission order for the drill-down", () => {
    const responses = [["Courageous"], ["Bold"], wordsForTribe("levi")];
    const { perObserver, observerCount } = aggregateObservers(responses);

    expect(observerCount).toBe(3);
    expect(perObserver).toHaveLength(3);
    perObserver.forEach((table, i) => {
      expect(table).toEqual(score(responses[i]));
    });
  });

  it("averages a single observer to exactly that observer's profile", () => {
    const only = ["Courageous", "Bold"];
    const { averaged } = aggregateObservers([only]);
    averaged.forEach((tribe, i) => {
      expect(tribe.score).toBeCloseTo(score(only)[i].score);
    });
  });

  it("yields an all-zero average and no observers for an empty input", () => {
    const { averaged, perObserver, observerCount } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(averaged).toHaveLength(12);
    expect(averaged.every((s) => s.score === 0)).toBe(true);
  });

  it("keeps every averaged score within the normalized 0–1 range", () => {
    const { averaged } = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      ["Bold", "Zealous"],
    ]);
    for (const s of averaged) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("hasEnoughObservers", () => {
  it("locks below the minimum and unlocks at or above it", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(2)).toBe(false);
    expect(hasEnoughObservers(3)).toBe(true);
    expect(hasEnoughObservers(5)).toBe(true);
  });
});
