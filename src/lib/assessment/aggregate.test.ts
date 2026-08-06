import { describe, it, expect } from "vitest";
import { score, type TribeScore } from "./score";
import { WORDS } from "./words";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
  type ObserverResponseWords,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const resp = (words: string[]): ObserverResponseWords => ({ words });

describe("aggregateObservers", () => {
  it("averages each observer's normalized scores with equal weight", () => {
    const responses = [
      resp(["Courageous", "Bold"]),
      resp(wordsForTribe("levi")),
    ];
    const agg = aggregateObservers(responses);

    // The "others" profile is exactly the per-tribe mean of the individually
    // scored responses — the definition of equal-weight averaging.
    const a = score(responses[0].words);
    const b = score(responses[1].words);
    for (const tribe of agg.others) {
      const expected = (scoreFor(tribe.slug, a) + scoreFor(tribe.slug, b)) / 2;
      expect(tribe.score).toBeCloseTo(expected);
    }
  });

  it("averages per-tribe, not by pooling words (equal-weight, ADR-0003)", () => {
    // Observer 1 gives Levi full coverage; Observer 2 gives Judah full coverage.
    // Each observer's profile is normalized to itself, so both peak at 1.0 for
    // their own tribe. Equal-weight averaging gives each exactly 0.5 in the
    // aggregate — regardless of how many words each observer picked.
    const agg = aggregateObservers([
      resp(wordsForTribe("levi")),
      resp(wordsForTribe("judah")),
    ]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("judah", agg.others)).toBeCloseTo(0.5);
  });

  it("does not let an observer who picks more words dominate the aggregate", () => {
    // Levi has 6 mapped words, Issachar 10. If aggregation pooled words, the
    // observer with more words (Issachar) would pull the aggregate toward their
    // tribe. Equal-weight averaging holds both at 0.5 for their own tribe.
    const levi = wordsForTribe("levi");
    const issachar = wordsForTribe("issachar");
    expect(levi.length).not.toBe(issachar.length); // precondition: unequal counts
    const agg = aggregateObservers([resp(levi), resp(issachar)]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(
      scoreFor("issachar", agg.others),
    );
  });

  it("returns the observer's own profile unchanged for a single observer", () => {
    const words = ["Courageous", "Bold", "Zealous"];
    const agg = aggregateObservers([resp(words)]);
    const solo = score(words);
    for (const tribe of agg.others) {
      expect(tribe.score).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("returns an all-zero profile and no observers for an empty input", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.every((t) => t.score === 0)).toBe(true);
    expect(agg.unlocked).toBe(false);
  });

  it("keeps the others profile in canonical (12-tribe) order", () => {
    const agg = aggregateObservers([resp(["Courageous"]), resp(["Bold"])]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((t) => t.slug)).toEqual(score([]).map((t) => t.slug));
  });

  it("exposes each observer's normalized profile with a 1-based anonymous index", () => {
    const responses = [resp(wordsForTribe("levi")), resp(wordsForTribe("judah"))];
    const agg = aggregateObservers(responses);
    expect(agg.perObserver.map((o) => o.index)).toEqual([1, 2]);
    // Observer 1's own profile peaks at Levi; Observer 2's at Judah.
    expect(scoreFor("levi", agg.perObserver[0].scores)).toBeCloseTo(1);
    expect(scoreFor("judah", agg.perObserver[1].scores)).toBeCloseTo(1);
  });

  it("counts observers and reports the unlock state", () => {
    const three = [resp(["Courageous"]), resp(["Bold"]), resp(["Zealous"])];
    const agg = aggregateObservers(three);
    expect(agg.observerCount).toBe(3);
    expect(agg.unlocked).toBe(true);
  });

  it("does not mutate the input responses", () => {
    const responses = [resp(["Courageous", "Bold"])];
    const snapshot = JSON.stringify(responses);
    aggregateObservers(responses);
    expect(JSON.stringify(responses)).toBe(snapshot);
  });
});

describe("isReportUnlocked", () => {
  it(`unlocks only at ${MIN_OBSERVERS_FOR_REPORT}+ observers`, () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT + 5)).toBe(true);
  });
});
