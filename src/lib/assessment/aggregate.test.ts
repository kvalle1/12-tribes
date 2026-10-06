import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  compareProfiles,
  hasEnoughObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "./aggregate";

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

const scoreFor = (slug: string, scores: readonly TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

describe("aggregateObservers", () => {
  it("returns a canonical-order 'others' profile and a per-observer breakdown", () => {
    const responses = [wordsForTribe("judah"), wordsForTribe("levi")];
    const agg = aggregateObservers(responses);

    expect(agg.observerCount).toBe(2);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(agg.perObserver).toHaveLength(2);
    // Each per-observer profile is exactly what the self scorer would produce.
    expect(agg.perObserver[0]).toEqual(score(wordsForTribe("judah")));
    expect(agg.perObserver[1]).toEqual(score(wordsForTribe("levi")));
  });

  it("averages per-observer normalized scores with equal weight", () => {
    // Observer 1 sees pure Judah (judah normalizes to 1.0); Observer 2 pure Levi.
    // The equal-weight 'others' profile puts each at exactly 0.5.
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
    ]);
    expect(scoreFor("judah", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
  });

  it("gives an observer who selects more words no extra influence", () => {
    // Levi has 6 words, Issachar 10. Full coverage normalizes to 1.0 for either,
    // so two observers — one 'all Levi', one 'all Issachar' — land at 0.5 each
    // despite the raw word-count gap. Effort is not influence (ADR-0003).
    const agg = aggregateObservers([
      wordsForTribe("levi"), // 6 words
      wordsForTribe("issachar"), // 10 words
    ]);
    expect(scoreFor("levi", agg.others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", agg.others)).toBeCloseTo(0.5);
  });

  it("is an average of normalized profiles, not a pooled bag of words", () => {
    // Pooling would concat all words and score once — the big selection would
    // dominate. Equal-weight averaging must differ from that pooled result.
    const heavy = wordsForTribe("judah"); // normalizes judah to 1.0
    const light = [wordsForTribe("judah")[0]]; // one judah word → small score

    const agg = aggregateObservers([heavy, light]);
    const pooled = score([...heavy, ...light]); // still full judah coverage → 1.0

    const lightJudah = scoreFor("judah", score(light));
    expect(scoreFor("judah", agg.others)).toBeCloseTo((1 + lightJudah) / 2);
    expect(scoreFor("judah", agg.others)).toBeLessThan(scoreFor("judah", pooled));
  });

  it("yields an all-zero profile and zero count for no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.observerCount).toBe(0);
    expect(agg.perObserver).toHaveLength(0);
    expect(agg.others.every((s) => s.score === 0)).toBe(true);
    expect(agg.others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });
});

describe("hasEnoughObservers", () => {
  it(`unlocks only at ${MIN_OBSERVERS_TO_UNLOCK} or more responses`, () => {
    expect(MIN_OBSERVERS_TO_UNLOCK).toBe(3);
    expect(hasEnoughObservers(0)).toBe(false);
    expect(hasEnoughObservers(2)).toBe(false);
    expect(hasEnoughObservers(3)).toBe(true);
    expect(hasEnoughObservers(5)).toBe(true);
  });
});

describe("compareProfiles", () => {
  const self = score(wordsForTribe("judah")); // judah = 1.0, rest 0
  const others = aggregateObservers([
    wordsForTribe("judah"),
    wordsForTribe("levi"),
  ]).others; // judah 0.5, levi 0.5

  it("pairs each tribe's self and others score and the signed divergence", () => {
    const rows = compareProfiles(self, others);
    expect(rows).toHaveLength(12);

    const judah = rows.find((r) => r.slug === "judah")!;
    expect(judah.self).toBeCloseTo(1);
    expect(judah.others).toBeCloseTo(0.5);
    // Others see Judah less strongly than the Subject does → negative divergence.
    expect(judah.divergence).toBeCloseTo(-0.5);

    const levi = rows.find((r) => r.slug === "levi")!;
    expect(levi.self).toBeCloseTo(0);
    expect(levi.others).toBeCloseTo(0.5);
    // Others surface Levi the Subject didn't → positive divergence.
    expect(levi.divergence).toBeCloseTo(0.5);
  });

  it("scales both bars against a shared max so they are visually comparable", () => {
    const rows = compareProfiles(self, others);
    const judah = rows.find((r) => r.slug === "judah")!;
    // Shared max is Judah-self = 1.0; its self bar is full, others half.
    expect(judah.selfRelative).toBeCloseTo(1);
    expect(judah.othersRelative).toBeCloseTo(0.5);
  });

  it("orders rows by prominence (max of self/others), ties by canonical order", () => {
    const rows = compareProfiles(self, others);
    expect(rows[0].slug).toBe("judah"); // prominence 1.0 leads
    // Levi (others 0.5) outranks every all-zero tribe.
    const leviIdx = rows.findIndex((r) => r.slug === "levi");
    const zeroIdx = rows.findIndex(
      (r) => r.self === 0 && r.others === 0,
    );
    expect(leviIdx).toBeLessThan(zeroIdx);
  });

  it("keeps all relatives at zero when nobody scored anything", () => {
    const empty = score([]);
    const rows = compareProfiles(empty, empty);
    expect(rows.every((r) => r.selfRelative === 0 && r.othersRelative === 0)).toBe(
      true,
    );
    expect(rows.every((r) => r.divergence === 0)).toBe(true);
  });
});
