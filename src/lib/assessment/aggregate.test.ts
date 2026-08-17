import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  hasEnoughObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate";

const scoreOf = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Single-tribe words, so a selection maps cleanly to one tribe in tests.
const JUDAH = ["Courageous", "Authoritative", "Honorable", "Sacrificial"];
const ASHER = ["Comforting", "Enriching", "Hospitable", "Nurturing"];

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("reports zero observers and all-zero scores for no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own normalized score when there is one", () => {
    const words = ["Courageous", "Honorable"];
    const agg = aggregateObservers([words]);
    expect(agg.observerCount).toBe(1);
    expect(agg.scores).toEqual(score(words));
  });

  it("averages per-observer normalized scores with equal weight", () => {
    const a = ["Courageous"]; // judah
    const b = ["Comforting"]; // asher
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreOf(tribe.slug, sa) + scoreOf(tribe.slug, sb)) / 2;
      expect(scoreOf(tribe.slug, agg.scores)).toBeCloseTo(expected, 10);
    }
  });

  it("is an equal-weight average, not a pooled bag of words", () => {
    // Two observers each cite one distinct judah word. A pooled bag would score
    // the union — summing the two — while the equal-weight average halves it.
    const a = ["Courageous"];
    const b = ["Honorable"];
    const agg = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]);

    expect(scoreOf("judah", agg.scores)).toBeCloseTo(
      scoreOf("judah", pooled) / 2,
      10,
    );
    // Strictly below the pooled score — proof it is not a pooled bag.
    expect(scoreOf("judah", agg.scores)).toBeLessThan(
      scoreOf("judah", pooled),
    );
  });

  it("gives an observer who selects more words no extra influence", () => {
    // The heavy observer cites four judah words; the light observer cites one
    // asher word. Each still contributes exactly one half to the average, so
    // word count never becomes influence (ADR-0003).
    const agg = aggregateObservers([JUDAH, ASHER.slice(0, 1)]);
    expect(scoreOf("judah", agg.scores)).toBeCloseTo(
      scoreOf("judah", score(JUDAH)) / 2,
      10,
    );
    expect(scoreOf("asher", agg.scores)).toBeCloseTo(
      scoreOf("asher", score(ASHER.slice(0, 1))) / 2,
      10,
    );
  });

  it("exposes each observer's individual normalized score in input order", () => {
    const a = ["Courageous"];
    const b = ["Comforting"];
    const agg = aggregateObservers([a, b]);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0]).toEqual(score(a));
    expect(agg.perObserver[1]).toEqual(score(b));
  });
});

describe("hasEnoughObservers", () => {
  it("unlocks only at three or more observers", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(2)).toBe(false);
    expect(hasEnoughObservers(3)).toBe(true);
    expect(hasEnoughObservers(5)).toBe(true);
  });
});
