import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  scoreObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** One arbitrary word mapping to a given tribe slug. */
const oneWordFor = (slug: string) => wordsForTribe(slug)[0];

describe("scoreObservers", () => {
  it("scores each observer independently into a normalized 12-tribe profile", () => {
    const profiles = scoreObservers([wordsForTribe("levi"), wordsForTribe("issachar")]);
    expect(profiles).toHaveLength(2);
    for (const profile of profiles) {
      expect(profile.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // Each observer's own tribe scores a perfect 1.0 in isolation.
    expect(scoreFor("levi", profiles[0])).toBeCloseTo(1);
    expect(scoreFor("issachar", profiles[1])).toBeCloseTo(1);
    // One observer's picks never bleed into the other's profile.
    expect(scoreFor("issachar", profiles[0])).toBe(0);
  });
});

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([wordsForTribe("levi")]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("returns an all-zero profile when there are no observers", () => {
    const others = aggregateObservers([]);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the observer's own profile when there is exactly one observer", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const others = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("averages per-observer normalized scores with equal weight", () => {
    // One observer reads pure Levi, another pure Issachar. Each tribe lands at
    // exactly half — the two observers count equally.
    const others = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
  });

  it("is the mean of the per-observer profiles, not a pooled bag of words", () => {
    // Observer A gives a full Levi read (all its words); Observer B contributes a
    // single Levi word. Equal-weight averaging is the mean of their two
    // individually-normalized Levi scores. Pooling the words instead would just
    // score the union (a full Levi read → 1.0), letting the wordier observer
    // dominate. The two must differ, and the aggregate must match the mean.
    const observerA = wordsForTribe("levi");
    const observerB = [oneWordFor("levi")];

    const meanLevi =
      (scoreFor("levi", score(observerA)) + scoreFor("levi", score(observerB))) / 2;
    const pooledLevi = scoreFor("levi", score([...observerA, ...observerB]));

    const others = aggregateObservers([observerA, observerB]);

    expect(scoreFor("levi", others)).toBeCloseTo(meanLevi);
    expect(pooledLevi).toBeGreaterThan(scoreFor("levi", others));
  });

  it("gives an observer who picks more words no extra influence", () => {
    // A verbose all-Levi observer and a terse single-word Judah observer. Despite
    // the word-count gap, neither tribe's aggregate exceeds 0.5 * that observer's
    // own score — each observer contributes exactly one equal share.
    const verbose = wordsForTribe("levi");
    const terse = ["Courageous"]; // a Judah word

    const others = aggregateObservers([verbose, terse]);
    expect(scoreFor("levi", others)).toBeCloseTo(scoreFor("levi", score(verbose)) / 2);
    expect(scoreFor("judah", others)).toBeCloseTo(scoreFor("judah", score(terse)) / 2);
  });

  it("exposes the ≥3 unlock threshold as a constant", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
