import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { WORDS } from "@/lib/assessment/words";
import {
  aggregateObservers,
  isObserverReportUnlocked,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** The score for one tribe within a profile. */
const at = (profile: TribeScore[], slug: string) =>
  profile.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("averages each observer's independently-normalized profile with equal weight", () => {
    // The core contract (ADR-0003): score each observer on their own, then take
    // the per-tribe arithmetic mean — coefficient 1/n each, no matter how many
    // words an observer picked.
    const many = [...wordsForTribe("judah"), ...wordsForTribe("levi")];
    const few = ["Wise"]; // a single issachar word
    const agg = aggregateObservers([many, few]);

    const a = score(many);
    const b = score(few);
    for (const tribe of agg.average) {
      expect(tribe.score).toBeCloseTo((at(a, tribe.slug) + at(b, tribe.slug)) / 2);
    }
  });

  it("gives a terse observer equal say — a pooled bag of words would hide it", () => {
    // One observer endorses judah emphatically (every judah word); another only
    // weakly (a single judah word). Equal-weight averaging lets the weak vote
    // pull the number down; pooling everyone's words into one score would leave
    // judah pinned at its ceiling and the dissent invisible.
    const emphatic = wordsForTribe("judah");
    const lukewarm = ["Courageous"];
    const agg = aggregateObservers([emphatic, lukewarm]);
    const pooled = score([...emphatic, ...lukewarm]);

    expect(at(pooled, "judah")).toBeCloseTo(1); // pooling hides the lukewarm vote
    expect(at(agg.average, "judah")).toBeLessThan(at(pooled, "judah"));
    expect(at(agg.average, "judah")).toBeCloseTo(
      (1 + at(score(lukewarm), "judah")) / 2,
    );
  });

  it("does not let a word-heavy observer outweigh a word-light one", () => {
    // Two observers who disagree: A (many words) says judah, B (one word) says
    // levi. Each tribe's average is exactly half of the observer who endorsed it,
    // so neither observer's word count buys extra influence.
    const heavyJudah = wordsForTribe("judah");
    const lightLevi = ["Dedicated"]; // one levi-only word
    const agg = aggregateObservers([heavyJudah, lightLevi]);

    expect(at(agg.average, "judah")).toBeCloseTo(at(score(heavyJudah), "judah") / 2);
    expect(at(agg.average, "levi")).toBeCloseTo(at(score(lightLevi), "levi") / 2);
  });

  it("reports the number of observers and keeps each profile in response order", () => {
    const responses = [["Courageous"], ["Dedicated"], ["Wise"]];
    const agg = aggregateObservers(responses);

    expect(agg.observerCount).toBe(3);
    expect(agg.observers).toHaveLength(3);
    // Order is preserved so the anonymous "Observer 1/2/3" numbering is stable.
    expect(at(agg.observers[0], "judah")).toBeGreaterThan(0);
    expect(at(agg.observers[1], "levi")).toBeGreaterThan(0);
    expect(at(agg.observers[2], "issachar")).toBeGreaterThan(0);
  });

  it("returns a single observer's profile unchanged as the average", () => {
    const agg = aggregateObservers([["Bold", "Zealous"]]);
    const solo = score(["Bold", "Zealous"]);
    for (const tribe of agg.average) {
      expect(tribe.score).toBeCloseTo(at(solo, tribe.slug));
    }
  });

  it("yields a neutral all-zero average for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.observers).toEqual([]);
    expect(agg.average).toHaveLength(12);
    expect(agg.average.every((s) => s.score === 0)).toBe(true);
  });

  it("returns all twelve tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"]]);
    expect(agg.average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("isObserverReportUnlocked", () => {
  it("locks the report below three observers", () => {
    expect(isObserverReportUnlocked(0)).toBe(false);
    expect(isObserverReportUnlocked(2)).toBe(false);
  });

  it("unlocks the report at three or more observers", () => {
    expect(isObserverReportUnlocked(MIN_OBSERVERS_TO_UNLOCK)).toBe(true);
    expect(isObserverReportUnlocked(5)).toBe(true);
  });

  it("unlocks at exactly three", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
  });
});
