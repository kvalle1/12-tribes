import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  MIN_OBSERVERS,
  hasEnoughObservers,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns an all-zero others profile for all 12 tribes in canonical order with no responses", () => {
    const { others, observerCount, perObserver } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals a single observer's own normalized scores when only one responded", () => {
    const words = ["Courageous", "Bold", "Authoritative"];
    const { others, observerCount, perObserver } = aggregateObservers([
      { words },
    ]);
    expect(observerCount).toBe(1);
    expect(perObserver).toHaveLength(1);
    // The equal-weight average over one observer is that observer's own profile.
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
      expect(scoreFor(tribe.slug, perObserver[0])).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
    }
  });

  it("averages per-observer normalized scores with equal weight (not a pooled bag of words)", () => {
    // Observer A: judah-heavy. Observer B: levi-heavy. The equal-weight average
    // of their individually-normalized profiles is the per-tribe mean.
    const a = ["Courageous", "Authoritative", "Bold"];
    const b = ["Dedicated", "Devoted", "Exacting"];
    const scoresA = score(a);
    const scoresB = score(b);

    const { others, observerCount } = aggregateObservers([
      { words: a },
      { words: b },
    ]);
    expect(observerCount).toBe(2);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, scoresA) + scoreFor(tribe.slug, scoresB)) / 2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected);
    }
  });

  it("gives a prolific observer no more influence than a sparse one (equal weight, not pooled)", () => {
    // Observer A picks many judah words; Observer B picks few levi words. Under
    // equal-weight averaging each observer's normalized profile counts once, so a
    // tribe only A scored and a tribe only B scored land at the same others-score
    // when each is the sole, fully-normalized signal for its observer... compare
    // instead against pooling, which would let A's larger word count dominate.
    const manyJudah = ["Courageous", "Authoritative"]; // judah-only words
    const fewLevi = ["Dedicated"]; // levi-only word

    const { others } = aggregateObservers([
      { words: manyJudah },
      { words: fewLevi },
    ]);

    // Each observer contributes half their own normalized judah/levi score.
    const expectedJudah = scoreFor("judah", score(manyJudah)) / 2;
    const expectedLevi = scoreFor("levi", score(fewLevi)) / 2;
    expect(scoreFor("judah", others)).toBeCloseTo(expectedJudah);
    expect(scoreFor("levi", others)).toBeCloseTo(expectedLevi);
  });

  it("exposes each observer's individually-normalized scores for anonymous drill-down, in input order", () => {
    const a = ["Courageous", "Authoritative"];
    const b = ["Dedicated", "Devoted"];
    const { perObserver } = aggregateObservers([{ words: a }, { words: b }]);
    expect(perObserver).toHaveLength(2);
    expect(scoreFor("judah", perObserver[0])).toBeCloseTo(
      scoreFor("judah", score(a)),
    );
    expect(scoreFor("levi", perObserver[1])).toBeCloseTo(
      scoreFor("levi", score(b)),
    );
    // Each per-observer profile is a full 12-tribe table in canonical order.
    for (const profile of perObserver) {
      expect(profile.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
  });

  it("does not mutate its input", () => {
    const responses = [{ words: ["Courageous"] }];
    const snapshot = JSON.stringify(responses);
    aggregateObservers(responses);
    expect(JSON.stringify(responses)).toBe(snapshot);
  });
});

describe("hasEnoughObservers (ADR-0003 ≥3 unlock)", () => {
  it("locks below the minimum and unlocks at or above it", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(MIN_OBSERVERS - 1)).toBe(false);
    expect(hasEnoughObservers(MIN_OBSERVERS)).toBe(true);
    expect(hasEnoughObservers(MIN_OBSERVERS + 5)).toBe(true);
  });
});
