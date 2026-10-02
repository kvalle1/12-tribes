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

describe("aggregateObservers", () => {
  it("returns a full 12-tribe table in canonical order", () => {
    const agg = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("is all-zero when there are no observers", () => {
    const agg = aggregateObservers([]);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals a single observer's own profile when there is one observer", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const agg = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("is the equal-weight mean of each observer's normalized profile (the core identity)", () => {
    // Derive the expected value straight from the real scoring core so the test
    // survives any normalization/threshold tuning.
    const lists = [["Courageous"], ["Bold"], [...wordsForTribe("issachar")]];
    const perObserver = lists.map((l) => score(l));
    const agg = aggregateObservers(lists);

    for (const tribe of tribes) {
      const mean =
        perObserver.reduce((sum, p) => sum + scoreFor(tribe.slug, p), 0) /
        perObserver.length;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(mean);
    }
  });

  it("averages per-observer profiles rather than pooling words into one bag", () => {
    // One observer fully covers Levi (score 1.0 for levi); another says nothing
    // about Levi. Equal-weight average ⇒ 0.5. A pooled bag of the same words
    // would still score Levi ~1.0, so this distinguishes the two approaches.
    const fullLevi = wordsForTribe("levi");
    const noLevi = ["Courageous"]; // judah-only word, nothing for levi

    const averaged = scoreFor("levi", aggregateObservers([fullLevi, noLevi]));
    const pooled = scoreFor("levi", score([...fullLevi, ...noLevi]));

    expect(averaged).toBeCloseTo(0.5);
    expect(pooled).toBeGreaterThan(averaged + 0.1);
  });

  it("gives a wordier observer no more influence than a sparse one", () => {
    // Observer A picks many words but none for Levi; Observer B picks a single
    // word that fully belongs to Levi's coverage is unrealistic, so instead:
    // A is wordy (all of Issachar, 10 words), B is sparse (one Levi word).
    // Levi's "others" score must come entirely from B's single vote, halved by
    // the two-observer average — A's word count buys no suppression of Levi.
    const wordy = wordsForTribe("issachar"); // 10 words, zero for levi
    const sparse = [wordsForTribe("levi")[0]]; // 1 word, some levi

    const agg = aggregateObservers([wordy, sparse]);
    const expectedLevi = scoreFor("levi", score(sparse)) / 2;
    expect(scoreFor("levi", agg)).toBeCloseTo(expectedLevi);
    expect(scoreFor("levi", agg)).toBeGreaterThan(0);
  });

  it("keeps every tribe's aggregated score within 0–1", () => {
    const agg = aggregateObservers([
      wordsForTribe("judah"),
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("scoreEachObserver", () => {
  it("scores each observer independently, preserving input order", () => {
    const lists = [["Courageous"], [...wordsForTribe("levi")]];
    const perObserver = scoreEachObserver(lists);
    expect(perObserver).toHaveLength(2);
    expect(scoreFor("judah", perObserver[0])).toBeCloseTo(
      scoreFor("judah", score(["Courageous"])),
    );
    expect(scoreFor("levi", perObserver[1])).toBeCloseTo(1);
  });
});

describe("isReportUnlocked", () => {
  it(`locks below ${MIN_OBSERVERS} observers and unlocks at or above`, () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("returns the signed self−others gap per tribe, aligned by slug", () => {
    const self = score(wordsForTribe("judah"));
    const others = aggregateObservers([wordsForTribe("levi")]);
    const diff = compareProfiles(self, others);

    expect(diff.map((d) => d.slug)).toEqual(tribes.map((t) => t.slug));

    const judah = diff.find((d) => d.slug === "judah")!;
    expect(judah.delta).toBeCloseTo(judah.self - judah.others);
    expect(judah.self).toBeGreaterThan(judah.others); // self leads where self picked

    const levi = diff.find((d) => d.slug === "levi")!;
    expect(levi.others).toBeGreaterThan(levi.self); // others lead where others picked
    expect(levi.delta).toBeLessThan(0);
  });

  it("aligns by slug regardless of input ordering", () => {
    const self = score(wordsForTribe("judah"));
    const shuffledOthers = [...aggregateObservers([wordsForTribe("judah")])].reverse();
    const diff = compareProfiles(self, shuffledOthers);
    const judah = diff.find((d) => d.slug === "judah")!;
    expect(judah.delta).toBeCloseTo(0); // identical self & others profiles
  });
});
