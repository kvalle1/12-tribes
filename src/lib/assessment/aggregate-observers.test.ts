import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  hasEnoughObservers,
  MIN_OBSERVERS_FOR_REPORT,
  type ObserverResponseInput,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Pure single-tribe words, so each selection touches exactly the intended tribe
// and leaves the others at zero — which makes the equal-weight arithmetic easy
// to reason about in these tests.
const ASHER_WORDS = [
  "Comforting",
  "Enriching",
  "Hospitable",
  "Nurturing",
  "Peaceful",
  "Welcoming",
]; // all map only to "asher"
const JUDAH_WORDS = ["Authoritative", "Courageous", "Honorable", "Sacrificial"]; // all map only to "judah"

const resp = (words: string[]): ObserverResponseInput => ({ words });

describe("aggregateObservers", () => {
  it("scores each observer with the same normalized core as the Subject", () => {
    const responses = [resp(ASHER_WORDS), resp(JUDAH_WORDS)];
    const { perObserver } = aggregateObservers(responses);

    expect(perObserver).toHaveLength(2);
    // Each observer's profile is exactly what the shared `score` core produces.
    expect(perObserver[0].scores).toEqual(score(ASHER_WORDS));
    expect(perObserver[1].scores).toEqual(score(JUDAH_WORDS));
  });

  it("labels observers 1..N anonymously in input order, with no other attributes", () => {
    const { perObserver } = aggregateObservers([
      resp(ASHER_WORDS),
      resp(JUDAH_WORDS),
      resp(ASHER_WORDS),
    ]);

    expect(perObserver.map((o) => o.index)).toEqual([1, 2, 3]);
    // The only fields carried are the anonymous index and the scores.
    expect(Object.keys(perObserver[0]).sort()).toEqual(["index", "scores"]);
  });

  it("returns the equal-weight average (mean) of per-observer scores for every tribe", () => {
    const responses = [
      resp(ASHER_WORDS),
      resp(JUDAH_WORDS),
      resp(["Dedicated", "Devoted", "Exacting"]), // levi-only
    ];
    const { average, perObserver, observerCount } =
      aggregateObservers(responses);

    expect(observerCount).toBe(3);
    // For each tribe, the aggregate equals the arithmetic mean across observers.
    for (const tribe of tribes) {
      const mean =
        perObserver.reduce((sum, o) => sum + scoreFor(tribe.slug, o.scores), 0) /
        observerCount;
      expect(scoreFor(tribe.slug, average)).toBeCloseTo(mean, 10);
    }
  });

  it("weights every observer equally regardless of how many words they picked (not a pooled bag)", () => {
    // A "loud" observer picks six asher words; a "quiet" one picks a two-word
    // subset. Pooling their words would let the loud observer dominate; equal
    // weighting must not.
    const loud = ASHER_WORDS; // 6 words, all asher
    const quiet = ["Comforting", "Enriching"]; // 2 words, subset of loud

    const { average } = aggregateObservers([resp(loud), resp(quiet)]);

    const equalWeightAsher =
      (scoreFor("asher", score(loud)) + scoreFor("asher", score(quiet))) / 2;
    expect(scoreFor("asher", average)).toBeCloseTo(equalWeightAsher, 10);

    // Contrast: a pooled bag of all their words (the union — quiet ⊂ loud) would
    // score asher as if only the loud observer answered, letting word-count buy
    // influence. The equal-weight average must be strictly lower.
    const pooledAsher = scoreFor("asher", score([...loud, ...quiet]));
    expect(pooledAsher).toBeGreaterThan(scoreFor("asher", average));
  });

  it("keeps canonical (tribe number) order in the average", () => {
    const { average } = aggregateObservers([resp(ASHER_WORDS)]);
    expect(average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("treats no observers as a fully-zero profile with count 0 (the locked state)", () => {
    const { average, perObserver, observerCount } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(average).toHaveLength(tribes.length);
    expect(average.every((s) => s.score === 0)).toBe(true);
    expect(average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("hasEnoughObservers", () => {
  it("unlocks only at or above the minimum threshold", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
    expect(hasEnoughObservers(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(hasEnoughObservers(MIN_OBSERVERS_FOR_REPORT + 5)).toBe(true);
  });
});
