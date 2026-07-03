import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { availablePointsByTribe, score, type TribeScore } from "./score";
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
  it("returns a score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([["Courageous"], ["Bold"]]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("scores all-zero when there are no observers", () => {
    const others = aggregateObservers([]);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("averages a single observer to exactly that observer's own profile", () => {
    const words = [...wordsForTribe("levi"), "Courageous"];
    const others = aggregateObservers([words]);
    const self = score(words);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(
        scoreFor(tribe.slug, self),
      );
    }
  });

  it("averages equal-weight per observer, not by pooling their words", () => {
    // Observer A fully covers Levi (score 1.0); Observer B fully covers Judah
    // (score 1.0). Equal-weight averaging gives each 0.5. A pooled "bag of
    // words" would instead normalize the combined selection and produce a
    // different shape — this asserts we do the former (ADR-0003).
    const a = wordsForTribe("levi");
    const b = wordsForTribe("judah");
    const others = aggregateObservers([a, b]);

    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("judah", others)).toBeCloseTo(0.5);

    // Contrast: pooling both selections into one score is NOT what we do.
    const pooled = score([...a, ...b]);
    expect(scoreFor("levi", pooled)).not.toBeCloseTo(
      scoreFor("levi", others),
    );
  });

  it("gives an observer who picks more words no more influence", () => {
    // Levi has 6 words, Issachar 10. Observer A fully covers Levi (6 words),
    // Observer B fully covers Issachar (10 words). Because each observer is
    // individually normalized before averaging, B's larger selection does not
    // buy Issachar more weight — both land at exactly 0.5.
    const others = aggregateObservers([
      wordsForTribe("levi"),
      wordsForTribe("issachar"),
    ]);
    expect(scoreFor("levi", others)).toBeCloseTo(0.5);
    expect(scoreFor("issachar", others)).toBeCloseTo(0.5);
  });

  it("keeps each observer's score in the 0–1 normalized range", () => {
    const others = aggregateObservers([
      wordsForTribe("levi"),
      ["Courageous", "Bold"],
      wordsForTribe("issachar"),
    ]);
    for (const s of others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("ignores unknown words within an observer's selection", () => {
    const clean = aggregateObservers([["Courageous"]]);
    const noisy = aggregateObservers([["Courageous", "notaword"]]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, noisy)).toBeCloseTo(
        scoreFor(tribe.slug, clean),
      );
    }
  });
});

describe("scoreEachObserver", () => {
  it("returns one normalized profile per observer, in input order", () => {
    const lists = [wordsForTribe("levi"), wordsForTribe("judah")];
    const each = scoreEachObserver(lists);
    expect(each).toHaveLength(2);
    expect(scoreFor("levi", each[0])).toBeCloseTo(1);
    expect(scoreFor("judah", each[1])).toBeCloseTo(1);
  });

  it("aggregateObservers is the equal-weight mean of scoreEachObserver", () => {
    const lists = [
      wordsForTribe("levi"),
      wordsForTribe("judah"),
      ["Courageous", "Bold"],
    ];
    const each = scoreEachObserver(lists);
    const others = aggregateObservers(lists);
    for (const tribe of tribes) {
      const mean =
        each.reduce((sum, o) => sum + scoreFor(tribe.slug, o), 0) / each.length;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(mean);
    }
  });
});

describe("compareProfiles", () => {
  it("pairs self and others per tribe with a signed divergence", () => {
    const self = score(wordsForTribe("levi"));
    const others = aggregateObservers([wordsForTribe("judah")]);
    const rows = compareProfiles(self, others);

    expect(rows).toHaveLength(12);
    const levi = rows.find((r) => r.slug === "levi")!;
    const judah = rows.find((r) => r.slug === "judah")!;
    // Self sees Levi, others see Judah — divergence is self − others.
    expect(levi.self).toBeGreaterThan(levi.others);
    expect(levi.divergence).toBeCloseTo(levi.self - levi.others);
    expect(judah.others).toBeGreaterThan(judah.self);
    expect(judah.divergence).toBeLessThan(0);
  });

  it("sorts rows by their strongest side, highest first", () => {
    const self = score(wordsForTribe("levi"));
    const others = aggregateObservers([wordsForTribe("judah")]);
    const rows = compareProfiles(self, others);
    for (let i = 1; i < rows.length; i++) {
      const prev = Math.max(rows[i - 1].self, rows[i - 1].others);
      const cur = Math.max(rows[i].self, rows[i].others);
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });
});

describe("isReportUnlocked", () => {
  it(`locks the report below ${MIN_OBSERVERS} observers`, () => {
    expect(MIN_OBSERVERS).toBe(3);
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS - 1)).toBe(false);
  });

  it("unlocks at and beyond the minimum", () => {
    expect(isReportUnlocked(MIN_OBSERVERS)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS + 5)).toBe(true);
  });
});

describe("scoring core sanity (guards the equal-weight assumption)", () => {
  it("full single-tribe coverage scores 1.0 regardless of that tribe's word count", () => {
    // The averaging math above relies on this: a fully-covered tribe is 1.0.
    expect(scoreFor("levi", score(wordsForTribe("levi")))).toBeCloseTo(1);
    expect(scoreFor("issachar", score(wordsForTribe("issachar")))).toBeCloseTo(1);
    // Sanity that these tribes really do differ in coverage.
    expect(availablePointsByTribe["levi"]).not.toBeCloseTo(
      availablePointsByTribe["issachar"],
    );
  });
});
