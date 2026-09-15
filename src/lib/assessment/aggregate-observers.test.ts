import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { score } from "./score";
import {
  aggregateObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate-observers";

/** Score a tribe out of an aggregate/profile by slug, for readable assertions. */
const scoreOf = (profile: { slug: string; score: number }[], slug: string) =>
  profile.find((t) => t.slug === slug)!.score;

// Real words from the live list, chosen so each selection maps to a single tribe
// (see words.ts). Judah and Levi selections deliberately differ in length so the
// "more words must not mean more influence" property is actually exercised.
const JUDAH_WORDS = ["Authoritative", "Courageous", "Honorable", "Sacrificial"]; // 4 words
const LEVI_WORDS = ["Dedicated", "Devoted", "Exacting", "Precise", "Reverent"]; // 5 words

describe("aggregateObservers", () => {
  it("returns a zeroed profile and no observers for an empty input", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others.every((t) => t.score === 0)).toBe(true);
    expect(agg.others).toHaveLength(tribes.length);
  });

  it("returns the observer's own profile verbatim when there is one observer", () => {
    const agg = aggregateObservers([JUDAH_WORDS]);
    expect(agg.observerCount).toBe(1);
    expect(agg.perObserver).toHaveLength(1);
    expect(agg.perObserver[0]).toEqual(score(JUDAH_WORDS));
    expect(agg.others).toEqual(score(JUDAH_WORDS));
  });

  it("emits both the aggregate and each observer in canonical tribe order", () => {
    const agg = aggregateObservers([JUDAH_WORDS, LEVI_WORDS]);
    const canonical = tribes.map((t) => t.slug);
    expect(agg.others.map((t) => t.slug)).toEqual(canonical);
    for (const profile of agg.perObserver) {
      expect(profile.map((t) => t.slug)).toEqual(canonical);
    }
  });

  it("is the equal-weight mean of the observers' individually-normalized scores", () => {
    const responses = [JUDAH_WORDS, LEVI_WORDS, ["Wise", "Analytical", "Patient"]];
    const agg = aggregateObservers(responses);
    const perObserver = responses.map((r) => score(r));

    for (const tribe of tribes) {
      const expected =
        perObserver.reduce((sum, p) => sum + scoreOf(p, tribe.slug), 0) /
        responses.length;
      expect(scoreOf(agg.others, tribe.slug)).toBeCloseTo(expected, 10);
    }
  });

  it("weights every observer equally regardless of how many words they picked", () => {
    // One observer describes a Judah subject with 4 words, another describes a
    // Levi subject with 5 words. Despite the extra word, each observer's own
    // tribe lands at exactly half its individually-normalized value in the
    // two-observer average — equal weight, not word-count weight.
    const agg = aggregateObservers([JUDAH_WORDS, LEVI_WORDS]);
    expect(scoreOf(agg.others, "judah")).toBeCloseTo(
      scoreOf(score(JUDAH_WORDS), "judah") / 2,
      10,
    );
    expect(scoreOf(agg.others, "levi")).toBeCloseTo(
      scoreOf(score(LEVI_WORDS), "levi") / 2,
      10,
    );
  });

  it("averages normalized profiles rather than pooling everyone's words", () => {
    const agg = aggregateObservers([JUDAH_WORDS, LEVI_WORDS]);
    // Pooling the two observers' words into one selection scores differently
    // (the longer selection would dominate); the aggregate must not equal it.
    const pooled = score([...JUDAH_WORDS, ...LEVI_WORDS]);
    expect(scoreOf(agg.others, "levi")).not.toBeCloseTo(
      scoreOf(pooled, "levi"),
      6,
    );
  });

  it("does not mutate the input responses", () => {
    const responses = [[...JUDAH_WORDS], [...LEVI_WORDS]];
    const snapshot = JSON.parse(JSON.stringify(responses));
    aggregateObservers(responses);
    expect(responses).toEqual(snapshot);
  });

  it("unlocks the comparison report at three observers", () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
  });
});
