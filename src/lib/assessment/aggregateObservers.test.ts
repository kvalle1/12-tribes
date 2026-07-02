import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import { aggregateObservers } from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns the equal-weight average of per-observer normalized scores", () => {
    const o1 = ["Courageous", "Bold"];
    const o2 = wordsForTribe("levi").slice(0, 5);
    const { average } = aggregateObservers([o1, o2]);

    const s1 = score(o1);
    const s2 = score(o2);
    for (const tribe of tribes) {
      const expected = (scoreFor(tribe.slug, s1) + scoreFor(tribe.slug, s2)) / 2;
      expect(scoreFor(tribe.slug, average)).toBeCloseTo(expected);
    }
  });

  it("weights each observer equally regardless of word count (not a pooled bag of words)", () => {
    // A "heavy" observer floods the panel with every judah word; a "light"
    // observer picks a single levi word. Pooling lets the heavy observer's word
    // count dominate the judah figure; equal-weight caps them at half the panel.
    const heavy = wordsForTribe("judah");
    const light = [wordsForTribe("levi")[0]];
    const { average } = aggregateObservers([heavy, light]);

    const expectedJudah =
      (scoreFor("judah", score(heavy)) + scoreFor("judah", score(light))) / 2;
    expect(scoreFor("judah", average)).toBeCloseTo(expectedJudah);

    // Pooling every word into one bag lets the many-word observer dominate judah
    // (their full judah expression), where equal weight holds it to half the panel.
    const pooledJudah = scoreFor("judah", score([...heavy, ...light]));
    expect(scoreFor("judah", average)).toBeLessThan(pooledJudah);

    // Meanwhile the light observer's lone levi word still counts at full
    // half-weight — one of two observers — not diluted by the other's word count.
    expect(scoreFor("levi", average)).toBeCloseTo(scoreFor("levi", score(light)) / 2);
  });

  it("covers all 12 tribes in canonical order in the average", () => {
    const { average } = aggregateObservers([["Courageous"]]);
    expect(average.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of average) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("equals the single observer's own scores when there is exactly one", () => {
    const words = ["Courageous", "Bold"];
    const { average, count } = aggregateObservers([words]);
    expect(count).toBe(1);
    const own = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, average)).toBeCloseTo(scoreFor(tribe.slug, own));
    }
  });

  it("returns an all-zero profile and no observers for no responses", () => {
    const { average, observers, count } = aggregateObservers([]);
    expect(count).toBe(0);
    expect(observers).toEqual([]);
    expect(average).toHaveLength(12);
    expect(average.every((s) => s.score === 0)).toBe(true);
  });

  it("exposes anonymous, order-numbered per-observer breakdown for drill-down", () => {
    const responses = [["Courageous"], wordsForTribe("levi").slice(0, 3), ["Bold"]];
    const { observers, count } = aggregateObservers(responses);

    expect(count).toBe(3);
    expect(observers).toHaveLength(3);
    expect(observers.map((o) => o.label)).toEqual([
      "Observer 1",
      "Observer 2",
      "Observer 3",
    ]);
    // Each observer carries only an anonymous label and normalized scores —
    // nothing that could identify who responded.
    for (const observer of observers) {
      expect(Object.keys(observer).sort()).toEqual(["label", "scores"]);
      expect(observer.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    }
    // The first observer's per-tribe scores match scoring their words directly.
    const first = score(["Courageous"]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, observers[0].scores)).toBeCloseTo(
        scoreFor(tribe.slug, first),
      );
    }
  });
});
