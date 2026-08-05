import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { score, type TribeScore } from "./score";
import {
  scoreObservers,
  aggregateObservers,
  compareProfiles,
} from "./aggregate-observers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/** All words that map to a given tribe slug. */
const wordsForTribe = (slug: string) =>
  WORDS.filter((w) => w.tribes.includes(slug)).map((w) => w.word);

/** Build a synthetic score table, defaulting the untouched tribes to 0. */
const tableFrom = (overrides: Record<string, number>): TribeScore[] =>
  tribes.map((t) => ({
    slug: t.slug,
    name: t.name,
    score: overrides[t.slug] ?? 0,
  }));

describe("scoreObservers", () => {
  it("scores each Observer independently with the shared core", () => {
    const a = wordsForTribe("judah");
    const b = wordsForTribe("levi");
    const profiles = scoreObservers([a, b]);
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toEqual(score(a));
    expect(profiles[1]).toEqual(score(b));
  });

  it("returns no profiles for no responses", () => {
    expect(scoreObservers([])).toEqual([]);
  });
});

describe("aggregateObservers", () => {
  it("returns a 0–1 score for all 12 tribes in canonical order", () => {
    const agg = aggregateObservers([wordsForTribe("judah")]);
    expect(agg).toHaveLength(12);
    expect(agg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of agg) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("is all-zero when no Observers have responded", () => {
    const agg = aggregateObservers([]);
    expect(agg).toHaveLength(12);
    expect(agg.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the Observer's own profile for a single response", () => {
    const words = wordsForTribe("judah");
    expect(aggregateObservers([words])).toEqual(score(words));
  });

  it("is the equal-weight mean of each Observer's normalized profile", () => {
    // The core contract (ADR-0003): the 'others' profile is the per-tribe mean
    // of each Observer's individually-normalized score — every Observer counts
    // once. Verify it tribe by tribe against the explicit mean.
    const a = wordsForTribe("judah");
    const b = wordsForTribe("reuben");
    const agg = aggregateObservers([a, b]);
    const sa = score(a);
    const sb = score(b);
    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, sa) + scoreFor(tribe.slug, sb)) / 2;
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(expected);
    }
  });

  it("weights each Observer equally regardless of word count (not a pooled bag)", () => {
    // A wordy Observer and a terse one each get one equal vote. Pooling their
    // words into one bag would let the wordy Observer swamp the terse one; the
    // equal-weight mean halves each Observer's contribution instead.
    const wordy = wordsForTribe("judah"); // full judah coverage → judah 1.0
    const terse = wordsForTribe("levi").slice(0, 1); // a single word
    const agg = aggregateObservers([wordy, terse]);
    const pooled = score([...wordy, ...terse]);

    const expectedJudah =
      (scoreFor("judah", score(wordy)) + scoreFor("judah", score(terse))) / 2;
    expect(scoreFor("judah", agg)).toBeCloseTo(expectedJudah);
    // Pooling keeps judah near its full 1.0; equal-weight lands it near half.
    expect(scoreFor("judah", agg)).toBeLessThan(scoreFor("judah", pooled));
  });

  it("averages identical responses to that same profile", () => {
    const words = wordsForTribe("issachar");
    const agg = aggregateObservers([words, words, words]);
    for (const tribe of tribes) {
      expect(scoreFor(tribe.slug, agg)).toBeCloseTo(
        scoreFor(tribe.slug, score(words)),
      );
    }
  });
});

describe("compareProfiles", () => {
  it("pairs self and others by tribe with the signed gap (others − self)", () => {
    const self = score(wordsForTribe("judah"));
    const others = aggregateObservers([wordsForTribe("levi")]);
    const cmp = compareProfiles(self, others);

    expect(cmp).toHaveLength(12);
    const judah = cmp.find((c) => c.slug === "judah")!;
    expect(judah.self).toBeCloseTo(scoreFor("judah", self));
    expect(judah.others).toBeCloseTo(scoreFor("judah", others));
    expect(judah.divergence).toBeCloseTo(judah.others - judah.self);
  });

  it("sorts by the Subject's own score, strongest first", () => {
    const cmp = compareProfiles(
      tableFrom({ judah: 0.3, levi: 0.9, reuben: 0.6 }),
      tableFrom({}),
    );
    expect(cmp.map((c) => c.slug).slice(0, 3)).toEqual([
      "levi",
      "reuben",
      "judah",
    ]);
  });

  it("breaks self-score ties by canonical tribe order", () => {
    const cmp = compareProfiles(
      tableFrom({ judah: 0.5, benjamin: 0.5 }),
      tableFrom({}),
    );
    const judahIdx = cmp.findIndex((c) => c.slug === "judah");
    const benjaminIdx = cmp.findIndex((c) => c.slug === "benjamin");
    expect(judahIdx).toBeLessThan(benjaminIdx);
  });
});
