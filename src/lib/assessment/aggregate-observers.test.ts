import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  scoreEachObserver,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Words with known mappings (see words.ts):
//   "Courageous" → judah only (a full judah point)
//   "Bold"       → judah + reuben (half a judah point)
//   "Dedicated"/"Devoted"/"Reverent"/"Precise" → levi only (zero judah signal)

describe("scoreEachObserver", () => {
  it("returns one normalized profile per response, each in canonical order", () => {
    const profiles = scoreEachObserver([["Courageous"], ["Bold"]]);
    expect(profiles).toHaveLength(2);
    for (const p of profiles) {
      expect(p.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
      for (const s of p) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("scores each observer independently (matches score() per response)", () => {
    const [a, b] = scoreEachObserver([["Courageous"], ["Bold"]]);
    expect(a).toEqual(score(["Courageous"]));
    expect(b).toEqual(score(["Bold"]));
  });

  it("returns an empty list for no responses", () => {
    expect(scoreEachObserver([])).toEqual([]);
  });
});

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"], ["Zealous"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores all-zero when there are no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own normalized profile", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg).toEqual(score(["Courageous"]));
  });

  it("is the equal-weight average of per-observer normalized scores", () => {
    const first = scoreFor("judah", score(["Courageous"])); // full judah
    const second = scoreFor("judah", score(["Bold"])); // half judah
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(scoreFor("judah", agg)).toBeCloseTo((first + second) / 2);
  });

  it("averages per-observer scores rather than pooling their words", () => {
    // Observer A drives judah; Observer B has zero judah signal (levi words). The
    // equal-weight average halves A's judah, whereas pooling both observers'
    // words into a single score() call would leave judah at A's full value. This
    // is the ADR-0003 "not a pooled bag of words" contract.
    const a = ["Courageous"]; // judah-only
    const b = ["Dedicated"]; // levi-only, no judah
    const agg = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]);
    const half = scoreFor("judah", score(a)) / 2;

    expect(scoreFor("judah", agg)).toBeCloseTo(half);
    expect(scoreFor("judah", pooled)).toBeCloseTo(half * 2); // pooling keeps it full
    expect(scoreFor("judah", agg)).not.toBeCloseTo(scoreFor("judah", pooled));
  });

  it("gives every observer equal weight regardless of how many words they pick", () => {
    // Observer A picks one judah word; Observer B picks levi words. B picking more
    // words never dilutes A's equal-weighted half-share of the judah average.
    const a = ["Courageous"];
    const bSmall = ["Dedicated"];
    const bBig = ["Dedicated", "Devoted", "Reverent", "Precise"];
    const aJudahHalf = scoreFor("judah", score(a)) / 2;

    expect(scoreFor("judah", aggregateObservers([a, bSmall]))).toBeCloseTo(
      aJudahHalf,
    );
    expect(scoreFor("judah", aggregateObservers([a, bBig]))).toBeCloseTo(
      aJudahHalf,
    );
  });

  it("does not mutate the input responses", () => {
    const responses = [["Courageous"], ["Bold"]];
    const snapshot = JSON.parse(JSON.stringify(responses));
    aggregateObservers(responses);
    expect(responses).toEqual(snapshot);
  });
});

describe("isReportUnlocked", () => {
  it("locks the report below the observer minimum", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks at and above the observer minimum", () => {
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });

  it("requires at least three observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
