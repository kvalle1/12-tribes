import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import { aggregateObservers } from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Three realistic, distinct 8-word observer selections leaning to different
// tribes, so aggregation has a spread to average over.
const JUDAH_LEANING = [
  "Authoritative",
  "Courageous",
  "Honorable",
  "Sacrificial",
  "Bold",
  "Fervent",
  "Protective",
  "Strong",
];
const ASHER_LEANING = [
  "Comforting",
  "Enriching",
  "Hospitable",
  "Nurturing",
  "Peaceful",
  "Welcoming",
  "Generous",
  "Supportive",
];
const ISSACHAR_LEANING = [
  "Analytical",
  "Insightful",
  "Learned",
  "Measured",
  "Patient",
  "Wise",
  "Cautious",
  "Observant",
];

describe("aggregateObservers", () => {
  it("returns a 12-tribe others profile in canonical order", () => {
    const { others } = aggregateObservers([JUDAH_LEANING, ASHER_LEANING]);
    expect(others).toHaveLength(12);
    expect(others.map((o) => o.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("reports the count and preserves each observer's own normalized profile", () => {
    const responses = [JUDAH_LEANING, ASHER_LEANING, ISSACHAR_LEANING];
    const { count, observers } = aggregateObservers(responses);

    expect(count).toBe(3);
    expect(observers).toHaveLength(3);
    // Each drill-down profile is exactly that observer scored on their own.
    observers.forEach((profile, i) => {
      expect(profile).toEqual(score(responses[i]));
    });
  });

  it("averages per-observer normalized scores with equal weight, tribe by tribe", () => {
    const a = score(JUDAH_LEANING);
    const b = score(ASHER_LEANING);
    const { others } = aggregateObservers([JUDAH_LEANING, ASHER_LEANING]);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, a) + scoreFor(tribe.slug, b)) / 2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected);
    }
  });

  it("is an equal-weight average, NOT a pooled bag of words", () => {
    // Observer A leans Judah; Observer B contributes no Judah at all.
    const a = score(JUDAH_LEANING);
    const { others } = aggregateObservers([JUDAH_LEANING, ASHER_LEANING]);

    // Pooling every word into one selection scores Judah at A's full level,
    // because B adds no Judah — pooling would let one profile dominate.
    const pooled = score([...JUDAH_LEANING, ...ASHER_LEANING]);

    // The equal-weight average instead halves A's Judah (B's Judah is 0),
    // which is strictly less than the pooled value — proving it is not pooling.
    expect(scoreFor("judah", others)).toBeCloseTo(scoreFor("judah", a) / 2);
    expect(scoreFor("judah", others)).toBeLessThan(scoreFor("judah", pooled));
  });

  it("gives every observer one equal vote regardless of word count", () => {
    // A single-word observer and a full 8-word observer each count once. If word
    // count bought influence, the heavier observer would dominate; it must not.
    const light = ["Courageous"]; // one Judah word
    const heavy = ASHER_LEANING; // eight Asher words

    const { others } = aggregateObservers([light, heavy]);
    const lightProfile = score(light);
    const heavyProfile = score(heavy);

    for (const tribe of tribes) {
      const expected =
        (scoreFor(tribe.slug, lightProfile) +
          scoreFor(tribe.slug, heavyProfile)) /
        2;
      expect(scoreFor(tribe.slug, others)).toBeCloseTo(expected);
    }
  });

  it("shifts the average toward a repeated observer by exactly one equal vote", () => {
    const single = aggregateObservers([JUDAH_LEANING, ASHER_LEANING]);
    const withDuplicate = aggregateObservers([
      JUDAH_LEANING,
      ASHER_LEANING,
      JUDAH_LEANING,
    ]);

    const a = score(JUDAH_LEANING);
    const b = score(ASHER_LEANING);

    // Two Judah votes out of three vs one out of two — the duplicate is one more
    // equal vote, not extra weight from its words.
    const expectedJudah =
      (scoreFor("judah", a) * 2 + scoreFor("judah", b)) / 3;
    expect(scoreFor("judah", withDuplicate.others)).toBeCloseTo(expectedJudah);
    expect(scoreFor("judah", withDuplicate.others)).toBeGreaterThan(
      scoreFor("judah", single.others),
    );
  });

  it("yields a zeroed 12-tribe profile and count 0 for no responses", () => {
    const { count, others, observers } = aggregateObservers([]);
    expect(count).toBe(0);
    expect(observers).toEqual([]);
    expect(others).toHaveLength(12);
    expect(others.map((o) => o.slug)).toEqual(tribes.map((t) => t.slug));
    expect(others.every((o) => o.score === 0)).toBe(true);
  });
});
