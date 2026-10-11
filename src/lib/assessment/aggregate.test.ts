import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  averageProfiles,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores all-zero with no observer responses", () => {
    const others = aggregateObservers([]);
    expect(others).toHaveLength(12);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals a single observer's own normalized score when only one responded", () => {
    const words = wordsForTribe("levi");
    const others = aggregateObservers([words]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(
        scoreFor(tribe.slug, score(words)),
      );
    }
  });

  it("averages identical observers to that same profile (equal contribution)", () => {
    const words = wordsForTribe("levi");
    const one = aggregateObservers([words]);
    const three = aggregateObservers([words, words, words]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, three)).toBeCloseTo(
        scoreFor(tribe.slug, one),
      );
    }
  });

  it("averages per-tribe across observers (equal-weight mean)", () => {
    // One observer reads the subject as Levi, another as Judah. The 'others'
    // profile is the mean of the two individual normalized profiles.
    const leviWords = wordsForTribe("levi");
    const judahWords = wordsForTribe("judah");
    const others = aggregateObservers([leviWords, judahWords]);

    const leviAlone = scoreFor("levi", score(leviWords));
    const judahAlone = scoreFor("judah", score(judahWords));

    expect(scoreFor("levi", others)).toBeCloseTo(leviAlone / 2);
    expect(scoreFor("judah", others)).toBeCloseTo(judahAlone / 2);
  });

  it("weights each observer equally regardless of how many words they picked (not a pooled bag of words)", () => {
    // Observer A describes the subject with the full Issachar vocabulary (many
    // words); Observer B picks a single Judah-only word. If responses were
    // pooled into one bag, A's volume would swamp B. Equal-weight averaging
    // instead gives B's lone pick its full half-share: the 'others' Judah score
    // must be exactly half of what that single word scores on its own, no matter
    // how many words A contributed.
    const issacharWords = wordsForTribe("issachar");
    const observerA = issacharWords;
    const observerB = ["Courageous"]; // a Judah-only word

    const others = aggregateObservers([observerA, observerB]);

    const judahFromBAlone = scoreFor("judah", score(observerB));
    expect(judahFromBAlone).toBeGreaterThan(0);
    expect(scoreFor("judah", others)).toBeCloseTo(judahFromBAlone / 2);

    // Equal weight also caps A's influence: A fully covers Issachar (1.0 on
    // their own), but in the two-observer average that contributes just 0.5.
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);

    // A pooled bag of A+B would instead let A's many Issachar words dominate the
    // whole aggregate (Issachar stays at full 1.0), swamping B. That divergence
    // is exactly what distinguishes equal-weight averaging from pooling words.
    const pooled = score([...observerA, ...observerB]);
    expect(scoreFor("issachar", pooled)).toBeGreaterThan(
      scoreFor("issachar", others),
    );
  });

  it("does not mutate the input responses", () => {
    const words = ["Courageous", "Bold"];
    const responses = [words];
    const snapshot = [...words];
    aggregateObservers(responses);
    expect(words).toEqual(snapshot);
  });
});

describe("averageProfiles", () => {
  it("returns the all-zero canonical profile for no profiles", () => {
    const avg = averageProfiles([]);
    expect(avg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(avg.every((s) => s.score === 0)).toBe(true);
  });

  it("means already-scored profiles per tribe (matches aggregateObservers)", () => {
    const leviWords = wordsForTribe("levi");
    const judahWords = wordsForTribe("judah");
    const viaProfiles = averageProfiles([score(leviWords), score(judahWords)]);
    const viaWords = aggregateObservers([leviWords, judahWords]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, viaProfiles)).toBeCloseTo(
        scoreFor(tribe.slug, viaWords),
      );
    }
  });

  it("does not mutate the input profiles", () => {
    const profile = score(wordsForTribe("levi"));
    const snapshot = profile.map((s) => s.score);
    averageProfiles([profile, profile]);
    expect(profile.map((s) => s.score)).toEqual(snapshot);
  });
});

describe("isReportUnlocked", () => {
  it("stays locked below the minimum observer count", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks at and above the minimum observer count", () => {
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 1)).toBe(true);
  });

  it("requires at least 3 observers (ADR-0003)", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
