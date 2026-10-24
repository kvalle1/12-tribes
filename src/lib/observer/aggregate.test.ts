import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { WORDS } from "@/lib/assessment/words";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns an all-zero others profile for no responses", () => {
    const { observerCount, others, perObserver } = aggregateObservers([]);
    expect(observerCount).toBe(0);
    expect(perObserver).toEqual([]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("returns the others profile in canonical (tribe number) order", () => {
    const { others } = aggregateObservers([["Courageous"], ["Analytical"]]);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("equals a single observer's own normalized score when only one responded", () => {
    const words = ["Courageous", "Bold", "Zealous"];
    const { others, observerCount } = aggregateObservers([words]);
    expect(observerCount).toBe(1);
    const self = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(scoreFor(tribe.slug, self));
    }
  });

  it("averages per-observer normalized scores with equal weight", () => {
    // One observer sees judah, another sees issachar. Each individually
    // normalized; the average is half of each tribe's single-observer score.
    const a = ["Courageous"]; // judah-only word
    const b = ["Analytical"]; // issachar-only word
    const { others } = aggregateObservers([a, b]);

    const judahSolo = scoreFor("judah", score(a));
    const issacharSolo = scoreFor("issachar", score(b));
    expect(scoreFor("judah", others)).toBeCloseTo(judahSolo / 2);
    expect(scoreFor("issachar", others)).toBeCloseTo(issacharSolo / 2);
  });

  it("gives a word-heavy observer no more influence than a sparse one", () => {
    // Observer A selects every judah word (a perfect 1.0 for judah); observer B
    // selects a single issachar word. Because each is normalized before
    // averaging, A's larger word count does not dominate: judah and issachar each
    // land at exactly half their respective single-observer scores, proving word
    // count is not influence (ADR-0003).
    const heavy = wordsForTribe("judah"); // many words → judah 1.0
    const sparse = ["Analytical"]; // one word → issachar partial
    const { others } = aggregateObservers([heavy, sparse]);

    expect(scoreFor("judah", score(heavy))).toBeCloseTo(1);
    expect(scoreFor("judah", others)).toBeCloseTo(1 / 2);
    expect(scoreFor("issachar", others)).toBeCloseTo(
      scoreFor("issachar", score(sparse)) / 2,
    );
  });

  it("weights two observers equally even when one picks far more words", () => {
    // One observer maxes judah with its full (larger) word set; the other maxes
    // levi with its smaller word set. Each individually reaches 1.0 for its
    // tribe, so after equal-weight averaging judah and levi land at exactly the
    // same 0.5 — the observer who typed more words gained no extra influence
    // (ADR-0003). A pooled bag of words, by contrast, would tilt toward whichever
    // observer contributed more raw points.
    const judahHeavy = wordsForTribe("judah");
    const leviLight = wordsForTribe("levi");
    expect(judahHeavy.length).toBeGreaterThan(leviLight.length);

    const { others } = aggregateObservers([judahHeavy, leviLight]);
    expect(scoreFor("judah", others)).toBeCloseTo(0.5);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("judah", others)).toBeCloseTo(scoreFor("levi", others));
  });

  it("exposes each observer's own normalized profile for the anonymous drill-down", () => {
    const a = ["Courageous"];
    const b = ["Analytical"];
    const { perObserver } = aggregateObservers([a, b]);
    expect(perObserver).toHaveLength(2);
    expect(perObserver[0]).toEqual(score(a));
    expect(perObserver[1]).toEqual(score(b));
  });

  it("does not mutate the input responses", () => {
    const responses = [["Courageous"], ["Analytical"]];
    const snapshot = JSON.parse(JSON.stringify(responses));
    aggregateObservers(responses);
    expect(responses).toEqual(snapshot);
  });
});

describe("isReportUnlocked", () => {
  it("stays locked below the minimum observer count", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
  });

  it("unlocks at and above the minimum observer count", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT + 1)).toBe(true);
  });

  it("requires at least three observers", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
