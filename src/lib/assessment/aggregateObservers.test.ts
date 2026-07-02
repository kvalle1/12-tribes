import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  scoreEachObserver,
  compareProfiles,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: readonly TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns an all-zero profile for all 12 tribes in canonical order when there are no responses", () => {
    const profile = aggregateObservers([]);
    expect(profile).toHaveLength(12);
    expect(profile.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
    expect(profile.every((t) => t.score === 0)).toBe(true);
  });

  it("equals the sole Observer's own normalized profile when only one responds", () => {
    const words = wordsForTribe("levi");
    const aggregate = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, aggregate)).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
    }
  });

  it("averages each Observer's normalized score with equal weight, NOT as a pooled bag of words", () => {
    // Observer A reads the Subject as fully Judah; Observer B as fully Issachar.
    const observerA = wordsForTribe("judah");
    const observerB = wordsForTribe("issachar");

    const aggregate = aggregateObservers([observerA, observerB]);

    // Equal-weight: each tribe's full-coverage 1.0 is halved by the two votes.
    expect(scoreFor("judah", aggregate)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", aggregate)).toBeCloseTo(0.5);

    // Pooling all words and scoring once would instead credit BOTH tribes near
    // their full 1.0 — the very thing equal-weight aggregation must avoid.
    const pooled = score([...observerA, ...observerB]);
    expect(scoreFor("judah", pooled)).toBeCloseTo(1);
    expect(scoreFor("issachar", pooled)).toBeCloseTo(1);
    expect(scoreFor("judah", aggregate)).not.toBeCloseTo(
      scoreFor("judah", pooled),
    );
  });

  it("gives an Observer who picked more words no more influence than one who picked fewer", () => {
    // A covers all of Judah's words (a big selection); B picks a single
    // Reuben-only word (a tiny one). Judah's aggregate must be exactly the
    // average of the two per-observer scores — B's small word count neither
    // dilutes nor amplifies A's Judah reading beyond one equal vote.
    const many = wordsForTribe("judah");
    const reubenOnly = WORDS.find(
      (w) => w.tribes.length === 1 && w.tribes[0] === "reuben",
    )!.word;
    const few = [reubenOnly];

    const aggregate = aggregateObservers([many, few]);
    const expectedJudah =
      (scoreFor("judah", score(many)) + scoreFor("judah", score(few))) / 2;
    expect(scoreFor("judah", aggregate)).toBeCloseTo(expectedJudah);
  });

  it("stays within 0–1 and returns all 12 tribes in canonical order", () => {
    const aggregate = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(aggregate.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
    for (const tribe of aggregate) {
      expect(tribe.score).toBeGreaterThanOrEqual(0);
      expect(tribe.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("scoreEachObserver", () => {
  it("scores each Observer independently, preserving input order", () => {
    const responses = [wordsForTribe("judah"), wordsForTribe("levi")];
    const profiles = scoreEachObserver(responses);
    expect(profiles).toHaveLength(2);
    expect(scoreFor("judah", profiles[0])).toBeCloseTo(1);
    expect(scoreFor("levi", profiles[1])).toBeCloseTo(1);
  });
});

describe("isReportUnlocked", () => {
  it(`locks the report below ${MIN_OBSERVERS} responses and unlocks at or above it`, () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(2)).toBe(false);
    expect(isReportUnlocked(3)).toBe(true);
    expect(isReportUnlocked(5)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("ranks tribes by the widest self-vs-others gap, signing delta as self − others", () => {
    const self = score(wordsForTribe("judah")); // Subject: strongly Judah
    const others = aggregateObservers([wordsForTribe("levi")]); // Others: Levi

    const divergences = compareProfiles(self, others);

    // Judah (self high, others low) and Levi (self low, others high) are the two
    // widest gaps and should sort to the front.
    const topTwo = divergences.slice(0, 2).map((d) => d.slug);
    expect(topTwo).toContain("judah");
    expect(topTwo).toContain("levi");

    const judah = divergences.find((d) => d.slug === "judah")!;
    expect(judah.delta).toBeGreaterThan(0); // Subject rates Judah higher
    const levi = divergences.find((d) => d.slug === "levi")!;
    expect(levi.delta).toBeLessThan(0); // others rate Levi higher

    // Sorted widest-first by magnitude.
    for (let i = 1; i < divergences.length; i++) {
      expect(divergences[i - 1].magnitude).toBeGreaterThanOrEqual(
        divergences[i].magnitude,
      );
    }
  });
});
