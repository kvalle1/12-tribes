import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

/** The score a given tribe gets for a single observer's word selection. */
const tribeScore = (slug: string, words: string[]) =>
  score(words).find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an all-zero, canonical-order, 12-tribe average for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.average.every((t) => t.score === 0)).toBe(true);
  });

  it("returns a single observer's own normalized scores as the average", () => {
    const words = ["Courageous", "Authoritative"]; // both map to judah
    const agg = aggregateObservers([words]);

    expect(agg.observerCount).toBe(1);
    expect(agg.average).toEqual(score(words));
  });

  it("averages each observer's normalized scores with equal weight", () => {
    // One observer leans judah, the other leans reuben. Each single-tribe word
    // contributes to exactly one tribe, so the averages are easy to predict.
    const a = ["Courageous"]; // judah only
    const b = ["Energetic"]; // reuben only
    const agg = aggregateObservers([a, b]);

    const avg = (slug: string) =>
      agg.average.find((t) => t.slug === slug)!.score;

    expect(avg("judah")).toBeCloseTo(tribeScore("judah", a) / 2);
    expect(avg("reuben")).toBeCloseTo(tribeScore("reuben", b) / 2);
  });

  it("weights each observer equally, not by how many words they picked (no pooled bag)", () => {
    // Observer A picks one judah word; observer B picks two. A pooled bag of
    // words would score judah as if all three words came from one person; the
    // equal-weight average must instead be the mean of the two per-observer
    // normalized scores.
    const a = ["Courageous"]; // judah x1
    const b = ["Courageous", "Authoritative"]; // judah x2
    const agg = aggregateObservers([a, b]);

    const aggJudah = agg.average.find((t) => t.slug === "judah")!.score;
    const pooledJudah = tribeScore("judah", [...a, ...b]); // the bag-of-words value

    expect(aggJudah).toBeCloseTo(
      (tribeScore("judah", a) + tribeScore("judah", b)) / 2,
    );
    // The equal-weight average is strictly less than the pooled value here,
    // proving a prolific observer does not gain extra influence.
    expect(aggJudah).toBeLessThan(pooledJudah);
  });

  it("exposes each observer's own scores for anonymous drill-down, in input order", () => {
    const a = ["Courageous"];
    const b = ["Energetic"];
    const agg = aggregateObservers([a, b]);

    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
  });

  it("does not mutate the input", () => {
    const responses = [["Courageous"], ["Energetic"]];
    const snapshot = JSON.stringify(responses);
    aggregateObservers(responses);
    expect(JSON.stringify(responses)).toBe(snapshot);
  });
});

describe("isReportUnlocked", () => {
  it("locks the report below the observer threshold", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD - 1)).toBe(false);
  });

  it("unlocks the report at or above the observer threshold", () => {
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD)).toBe(true);
    expect(isReportUnlocked(OBSERVER_UNLOCK_THRESHOLD + 2)).toBe(true);
  });
});
