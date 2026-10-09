import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "@/lib/assessment/words";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isComparisonUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "./aggregate";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([["Courageous"], ["Wise"], ["Dedicated"]]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("yields an all-zero profile for no observers", () => {
    const others = aggregateObservers([]);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own profile when there is one observer", () => {
    const words = wordsForTribe("levi");
    const others = aggregateObservers([words]);
    const solo = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(scoreFor(tribe.slug, solo));
    }
  });

  it("is the equal-weight mean of each observer's individually-normalized profile", () => {
    // The defining property (ADR-0003): aggregate[t] === mean over observers of
    // score(observer)[t]. Three observers with deliberately different, uneven
    // selections.
    const observers = [
      wordsForTribe("judah"),
      ["Wise", "Patient", "Analytical"],
      ["Dedicated", "Bold", "Generous", "Peaceful"],
    ];
    const perObserver = observers.map((w) => score(w));
    const others = aggregateObservers(observers);

    for (const tribe of tribes) {
      const mean =
        perObserver.reduce((sum, s) => sum + scoreFor(tribe.slug, s), 0) /
        perObserver.length;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(mean);
    }
  });

  it("gives each observer equal influence regardless of how many words they pick", () => {
    // A "heavy" observer fully backs Issachar (10 words); a "light" observer
    // fully backs Levi (6 words). Each fully covers its tribe, so each scores
    // 1.0 for its tribe in isolation. Equal-weight averaging must give both
    // tribes the SAME aggregate (0.5), proving the heavier word count bought no
    // extra influence.
    const heavy = wordsForTribe("issachar");
    const light = wordsForTribe("levi");
    expect(heavy.length).toBeGreaterThan(light.length);

    const others = aggregateObservers([heavy, light]);
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", others)).toBeCloseTo(scoreFor("levi", others));
  });

  it("averages per-observer profiles instead of pooling the words into one bag", () => {
    // A verbose observer (all Issachar words) and a terse one (one Levi word).
    // Pooling the words would leave Issachar at full strength (1.0); equal-weight
    // averaging halves it to ~0.5 because the terse observer counts just as much.
    const verbose = wordsForTribe("issachar");
    const terse = ["Dedicated"]; // a single Levi-only word

    const others = aggregateObservers([verbose, terse]);
    const pooled = score([...verbose, ...terse]);

    expect(scoreFor("issachar", pooled)).toBeCloseTo(1);
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", others)).not.toBeCloseTo(
      scoreFor("issachar", pooled),
    );
  });
});

describe("isComparisonUnlocked", () => {
  it("stays locked below the threshold and unlocks at or above it", () => {
    expect(OBSERVER_UNLOCK_THRESHOLD).toBe(3);
    expect(isComparisonUnlocked(0)).toBe(false);
    expect(isComparisonUnlocked(2)).toBe(false);
    expect(isComparisonUnlocked(3)).toBe(true);
    expect(isComparisonUnlocked(5)).toBe(true);
  });
});
