import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "./aggregate";

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a normalized 0–1 others profile for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe("judah").slice(0, 8)]);
    expect(agg.others).toHaveLength(12);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg.others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("reports the observer count and one per-observer profile per response", () => {
    const responses = [wordsForTribe("judah"), wordsForTribe("levi")];
    const agg = aggregateObservers(responses);
    expect(agg.observerCount).toBe(2);
    expect(agg.perObserver).toHaveLength(2);
    expect(agg.perObserver[0].map((s) => s.slug)).toEqual(
      tribes.map((t) => t.slug),
    );
  });

  it("zeroes an empty observer set without dividing by zero", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
  });

  it("averages equally — the others profile is the mean of per-observer scores", () => {
    // Observer A reads pure Judah, Observer B reads pure Levi. The averaged
    // "others" profile is each tribe's per-observer mean.
    const a = wordsForTribe("judah");
    const b = wordsForTribe("levi");
    const agg = aggregateObservers([a, b]);

    const soloJudah = scoreFor("judah", score(a)); // observer A's judah score
    const soloLevi = scoreFor("levi", score(b)); // observer B's levi score

    // A scored judah=soloJudah, B scored judah=0 → mean soloJudah/2.
    expect(scoreFor("judah", agg.others)).toBeCloseTo(soloJudah / 2);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(soloLevi / 2);
  });

  it("weights each observer equally regardless of how many words they picked (not a pooled bag of words)", () => {
    // A "verbose" observer picks the full Judah word list; a "terse" observer
    // picks a single Levi-only word. Under equal-weight averaging each observer
    // contributes exactly half of the others profile, so the terse observer's
    // one strong signal is not drowned out by the verbose observer's volume —
    // which is precisely what a pooled bag of words would do.
    const verbose = wordsForTribe("judah"); // many words, all Judah
    const terseWord = WORDS.find(
      (w) => w.tribes.length === 1 && w.tribes[0] === "levi",
    )!.word;
    const terse = [terseWord];

    const agg = aggregateObservers([verbose, terse]);

    // Equal weight: others.judah = mean(verbose.judah, 0) = verbose.judah / 2,
    // and others.levi = mean(0, terse.levi) = terse.levi / 2. The terse
    // observer's single word still moves levi to half its solo strength.
    const verboseJudah = scoreFor("judah", score(verbose));
    const terseLevi = scoreFor("levi", score(terse));
    expect(scoreFor("judah", agg.others)).toBeCloseTo(verboseJudah / 2);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(terseLevi / 2);

    // Pooled-bag contrast: if we naively concatenated everyone's words, the
    // verbose observer's many Judah words would saturate Judah for the whole
    // group (pushing it to its full solo strength), giving that one wordy
    // observer outsized influence. Equal-weight averaging caps their
    // contribution at 1/N, so the group's Judah reads lower than the pool's.
    const pooled = score([...verbose, ...terse]);
    expect(scoreFor("judah", pooled)).toBeGreaterThan(
      scoreFor("judah", agg.others),
    );
  });

  it("gives identical observers that same profile (averaging N copies is a no-op)", () => {
    const words = wordsForTribe("judah").slice(0, 10);
    const one = aggregateObservers([words]);
    const three = aggregateObservers([words, words, words]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, three.others)).toBeCloseTo(
        scoreFor(tribe.slug, one.others),
      );
    }
  });
});
