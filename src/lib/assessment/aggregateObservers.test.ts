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

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** The expected equal-weight mean of per-observer normalized scores, from the core. */
const expectedMean = (responses: string[][], slug: string) => {
  const per = responses.map((r) => scoreFor(slug, score(r)));
  return per.reduce((a, b) => a + b, 0) / per.length;
};

describe("aggregateObservers", () => {
  it("returns a 0 profile for all 12 tribes when there are no responses", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("averages per-observer normalized scores equally — one vote per observer, not a pooled bag of words", () => {
    // Two observers with deliberately different word counts. Equal-weight means
    // each observer's already-normalized profile counts exactly once, so the
    // aggregate is the plain mean of the two per-observer scores — the wordier
    // observer buys no extra pull.
    const observerA = ["Courageous"]; // 1 word
    const observerB = wordsForTribe("levi").slice(0, 6); // several words
    const responses = [observerA, observerB];

    const agg = aggregateObservers(responses);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(
        expectedMean(responses, tribe.slug),
      );
    }
  });

  it("is order-independent — reordering observers does not change the aggregate", () => {
    const a = wordsForTribe("judah").slice(0, 4);
    const b = wordsForTribe("levi").slice(0, 5);
    const forward = aggregateObservers([a, b]);
    const reversed = aggregateObservers([b, a]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, forward)).toBeCloseTo(
        scoreFor(tribe.slug, reversed),
      );
    }
  });

  it("does not let a wordier observer dominate a tribe only they didn't pick", () => {
    // observerFew picks a single word exclusive to one tribe; observerMany picks
    // many words for a *different* tribe. On observerFew's exclusive tribe,
    // observerMany contributes nothing, so the aggregate is exactly
    // observerFew's own score halved — abundance bought no influence there.
    const exclusiveWord = WORDS.find((w) => w.tribes.length === 1)!;
    const exclusiveSlug = exclusiveWord.tribes[0];
    const observerFew = [exclusiveWord.word];

    // A large selection for some other tribe, scrubbed of anything touching the
    // exclusive tribe so the isolation the assertion relies on is guaranteed.
    const otherSlug = tribes.find((t) => t.slug !== exclusiveSlug)!.slug;
    const observerMany = wordsForTribe(otherSlug).filter(
      (word) =>
        !WORDS.find((w) => w.word === word)!.tribes.includes(exclusiveSlug),
    );
    expect(observerMany.length).toBeGreaterThan(observerFew.length);

    const agg = aggregateObservers([observerFew, observerMany]);
    const fewSolo = scoreFor(exclusiveSlug, score(observerFew));
    expect(scoreFor(exclusiveSlug, agg)).toBeCloseTo(fewSolo / 2);
  });

  it("differs from pooling all words into one score (proves it is not a pooled bag)", () => {
    // Pooling concatenates everyone's words and scores once, letting a wordy
    // observer swamp the result. Equal-weight averaging must not equal that.
    const a = wordsForTribe("judah").slice(0, 3);
    const b = wordsForTribe("levi");
    const agg = aggregateObservers([a, b]);
    const pooled = score([...a, ...b]);

    const someTribeDiffers = tribes.some(
      (t) =>
        Math.abs(scoreFor(t.slug, agg) - scoreFor(t.slug, pooled)) > 1e-6,
    );
    expect(someTribeDiffers).toBe(true);
  });

  it("collapses to a single observer's own profile when all observers are identical", () => {
    const words = wordsForTribe("judah").slice(0, 5);
    const agg = aggregateObservers([words, words, words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });
});

describe("scoreEachObserver", () => {
  it("scores each observer individually, preserving input order for stable Observer N labels", () => {
    const responses = [
      wordsForTribe("judah").slice(0, 4),
      wordsForTribe("levi").slice(0, 4),
    ];
    const per = scoreEachObserver(responses);
    expect(per).toHaveLength(2);
    for (let i = 0; i < responses.length; i++) {
      const solo = score(responses[i]);
      for (const tribe of tribes) {
        expect(scoreFor(tribe.slug, per[i])).toBeCloseTo(
          scoreFor(tribe.slug, solo),
        );
      }
    }
  });
});

describe("compareProfiles", () => {
  it("reports self, others, and divergence (self − others) for all 12 tribes", () => {
    const self = score(wordsForTribe("judah").slice(0, 5));
    const others = aggregateObservers([wordsForTribe("levi").slice(0, 5)]);
    const cmp = compareProfiles(self, others);

    expect(cmp).toHaveLength(12);
    for (const tribe of tribes) {
      const row = cmp.find((c) => c.slug === tribe.slug)!;
      expect(row.self).toBeCloseTo(scoreFor(tribe.slug, self));
      expect(row.others).toBeCloseTo(scoreFor(tribe.slug, others));
      expect(row.divergence).toBeCloseTo(row.self - row.others);
    }
  });
});

describe("isReportUnlocked", () => {
  it(`locks below ${MIN_OBSERVERS} observers and unlocks at or above it`, () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});
