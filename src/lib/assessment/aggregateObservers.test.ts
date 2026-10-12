import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score } from "./score";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: { slug: string; score: number }[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns an all-zero profile with no observers for an empty list", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toEqual([]);
    expect(agg.scores).toHaveLength(12);
    expect(agg.scores.every((s) => s.score === 0)).toBe(true);
  });

  it("returns scores for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg.scores.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("equals the single observer's own profile when only one responded", () => {
    const words = ["Courageous", "Bold"];
    const agg = aggregateObservers([words]);
    const solo = score(words);
    expect(agg.observerCount).toBe(1);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(
        scoreFor(tribe.slug, solo),
      );
    }
  });

  it("is the equal-weight average of per-observer normalized profiles", () => {
    const a = ["Courageous"];
    const b = wordsForTribe("levi");
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    // Each tribe's aggregate is exactly the mean of the two observers' scores.
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, agg.scores)).toBeCloseTo(expected);
    }
  });

  it("weights every observer equally regardless of how many words they picked", () => {
    // Observer A picks a single judah word; Observer B picks ALL of levi's
    // words. Under equal-weight averaging each still contributes one normalized
    // vote, so judah reflects A alone (halved) and levi reflects B alone
    // (halved) — the larger pick does not gain extra influence.
    const judahOnly = ["Courageous"]; // judah-only word
    const leviAll = wordsForTribe("levi");
    const agg = aggregateObservers([judahOnly, leviAll]);

    expect(scoreFor("judah", agg.scores)).toBeCloseTo(
      scoreFor("judah", score(judahOnly)) / 2,
    );
    // B selected every levi word (a perfect 1.0), so the others profile is 0.5.
    expect(scoreFor("levi", agg.scores)).toBeCloseTo(0.5);
  });

  it("is not a pooled bag of words (differs from scoring the union)", () => {
    // One observer picks ALL of levi's words; another picks a single judah word.
    const leviAll = wordsForTribe("levi");
    const judahLight = ["Courageous"];
    const agg = aggregateObservers([leviAll, judahLight]);
    const pooled = score([...leviAll, ...judahLight]);

    // Pooling leaves levi saturated at 1.0 — one judah word can't dilute full
    // levi coverage — but the equal-weight average halves it to 0.5 because the
    // second observer gets an equal vote. The two aggregations disagree, which
    // is the whole point of equal-weight averaging over a pooled bag of words.
    expect(scoreFor("levi", pooled)).toBeCloseTo(1);
    expect(scoreFor("levi", agg.scores)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg.scores)).not.toBeCloseTo(
      scoreFor("levi", pooled),
    );
  });

  it("keeps each observer's profile, in order, for anonymous drill-down", () => {
    const responses = [["Courageous"], wordsForTribe("levi"), ["Bold"]];
    const agg = aggregateObservers(responses);
    expect(agg.observerCount).toBe(3);
    expect(agg.perObserver).toHaveLength(3);
    agg.perObserver.forEach((table, i) => {
      for (const tribe of tribes) {
        expect(scoreFor(tribe.slug, table)).toBeCloseTo(
          scoreFor(tribe.slug, score(responses[i])),
        );
      }
    });
  });

  it("exposes the ≥3 unlock threshold as a shared constant", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
