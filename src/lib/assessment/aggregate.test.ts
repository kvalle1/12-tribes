import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  isReportUnlocked,
  orderObserverResponses,
  MIN_OBSERVERS,
} from "./aggregate";

const scoreFor = (slug: string, scores: readonly TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Single-tribe words give clean, isolated signals per tribe.
const JUDAH = ["Courageous", "Authoritative", "Honorable", "Sacrificial"];
const ASHER = [
  "Comforting",
  "Enriching",
  "Hospitable",
  "Nurturing",
  "Peaceful",
  "Welcoming",
];

describe("aggregateObservers", () => {
  it("scores each observer individually in canonical tribe order", () => {
    const agg = aggregateObservers([JUDAH, ASHER]);
    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
    // Each per-observer profile is exactly that observer's own normalized score.
    expect(agg.perObserver[0]).toEqual(score(JUDAH));
    expect(agg.perObserver[1]).toEqual(score(ASHER));
    // Canonical (tribe number) order, all twelve tribes.
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.average).toHaveLength(12);
  });

  it("averages the per-observer normalized scores with equal weight (1/N each)", () => {
    const agg = aggregateObservers([JUDAH, ASHER]);
    for (const tribe of tribes) {
      const mean =
        (scoreFor(tribe.slug, agg.perObserver[0]) +
          scoreFor(tribe.slug, agg.perObserver[1])) /
        2;
      expect(scoreFor(tribe.slug, agg.average)).toBeCloseTo(mean);
    }
  });

  it("gives an observer who picks more words no extra influence", () => {
    // Observer 1 is fixed (one judah word). Observer 2 answers asher, first with
    // a single word, then with six. Observer 1's share of the averaged profile
    // must be identical in both cases — a 1/N stake that word count can't buy up.
    const light = aggregateObservers([["Courageous"], ["Comforting"]]);
    const heavy = aggregateObservers([["Courageous"], ASHER]);

    expect(scoreFor("judah", heavy.average)).toBeCloseTo(
      scoreFor("judah", light.average),
    );
    // And observer 1 still holds exactly half of its solo-normalized judah score.
    expect(scoreFor("judah", heavy.average)).toBeCloseTo(
      scoreFor("judah", score(["Courageous"])) / 2,
    );
    // Observer 2's richer answer only moved observer 2's own tribe.
    expect(scoreFor("asher", heavy.average)).toBeGreaterThan(
      scoreFor("asher", light.average),
    );
  });

  it("is an equal-weight average of profiles, not a pooled bag of words", () => {
    // Both observers name "Courageous"; observer 1 adds another judah word,
    // observer 2 adds an asher word. A pooled bag would dedupe the shared word
    // and score the union once; equal-weight counts each observer's answer in
    // full, so the two approaches diverge.
    const obs1 = ["Courageous", "Authoritative"];
    const obs2 = ["Courageous", "Comforting"];
    const agg = aggregateObservers([obs1, obs2]);
    const pooled = score([...obs1, ...obs2]);

    expect(scoreFor("judah", agg.average)).not.toBeCloseTo(
      scoreFor("judah", pooled),
    );
    // Equal-weight judah = (2 judah words + 1 judah word)/2, normalized.
    const expectedJudah =
      (scoreFor("judah", score(obs1)) + scoreFor("judah", score(obs2))) / 2;
    expect(scoreFor("judah", agg.average)).toBeCloseTo(expectedJudah);
  });

  it("returns an all-zero profile and no observers for empty input", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
  });

  it("keeps per-observer profiles anonymous — scores only, in input order", () => {
    const agg = aggregateObservers([ASHER, JUDAH]);
    expect(agg.perObserver[0]).toEqual(score(ASHER));
    expect(agg.perObserver[1]).toEqual(score(JUDAH));
    for (const profile of agg.perObserver) {
      for (const entry of profile) {
        expect(Object.keys(entry).sort()).toEqual(["name", "score", "slug"]);
      }
    }
  });

  it("does not mutate the input responses", () => {
    const obs1 = ["Courageous"];
    const responses = [obs1];
    aggregateObservers(responses);
    expect(responses).toEqual([["Courageous"]]);
    expect(obs1).toEqual(["Courageous"]);
  });
});

describe("orderObserverResponses", () => {
  const A = ["Courageous", "Honorable"];
  const B = ["Comforting", "Nurturing"];
  const C = ["Alert", "Vigilant"];

  it("orders purely by content, independent of input order", () => {
    // The same set of responses in any submission order yields the same display
    // order — so the order can't encode who answered when (anonymity, #9).
    const one = orderObserverResponses([A, B, C]);
    const two = orderObserverResponses([C, A, B]);
    const three = orderObserverResponses([B, C, A]);
    expect(two).toEqual(one);
    expect(three).toEqual(one);
  });

  it("is a permutation of the input — same responses, nothing added or dropped", () => {
    const ordered = orderObserverResponses([C, A, B]);
    expect(ordered).toHaveLength(3);
    expect([...ordered].sort()).toEqual([A, B, C].sort());
  });

  it("is stable for content-identical responses", () => {
    const dup1 = ["Alert", "Vigilant"];
    const dup2 = ["Alert", "Vigilant"];
    const ordered = orderObserverResponses([dup1, dup2, B]);
    expect(ordered).toHaveLength(3);
    expect(ordered.filter((r) => r.join() === "Alert,Vigilant")).toHaveLength(2);
  });

  it("treats word order within a response as the same content", () => {
    const forward = orderObserverResponses([["Courageous", "Honorable"], B]);
    const reversed = orderObserverResponses([["Honorable", "Courageous"], B]);
    expect(reversed.map((r) => [...r].sort())).toEqual(
      forward.map((r) => [...r].sort()),
    );
  });

  it("does not mutate the input", () => {
    const input = [C, A, B];
    orderObserverResponses(input);
    expect(input).toEqual([C, A, B]);
  });
});

describe("isReportUnlocked", () => {
  it("unlocks only at or above the minimum observer count", () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});
