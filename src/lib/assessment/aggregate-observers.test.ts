import { describe, expect, it } from "vitest";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregate-observers";
import { score, type TribeScore } from "./score";
import { tribes } from "@/lib/tribes";

const scoreOf = (slug: string, scores: TribeScore[]): number =>
  scores.find((s) => s.slug === slug)!.score;

// Two Observers whose readings share no tribes: A reads the Subject as
// dan/issachar, B as asher/zebulun/joseph. Because neither touches the other's
// tribes, the equal-weight vs. pooled-bag distinction becomes directly visible.
const OBS_A = [
  "Alert",
  "Deliberate",
  "Skeptical",
  "Vigilant",
  "Watchful",
  "Cautious",
  "Observant",
  "Strategic",
];
const OBS_B = [
  "Comforting",
  "Enriching",
  "Hospitable",
  "Nurturing",
  "Peaceful",
  "Welcoming",
  "Generous",
  "Supportive",
];

describe("aggregateObservers", () => {
  it("returns a score for every tribe in canonical order", () => {
    const out = aggregateObservers([OBS_A, OBS_B]);
    expect(out.map((t) => t.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("with no responses returns every tribe at zero", () => {
    const out = aggregateObservers([]);
    expect(out).toHaveLength(tribes.length);
    expect(out.every((t) => t.score === 0)).toBe(true);
  });

  it("with a single Observer equals that Observer's own profile", () => {
    const out = aggregateObservers([OBS_A]);
    const solo = score(OBS_A);
    for (const t of out) {
      expect(t.score).toBeCloseTo(scoreOf(t.slug, solo), 10);
    }
  });

  it("is the equal-weight mean of each Observer's individually-normalized profile", () => {
    const out = aggregateObservers([OBS_A, OBS_B]);
    const a = score(OBS_A);
    const b = score(OBS_B);
    for (const t of out) {
      const expected = (scoreOf(t.slug, a) + scoreOf(t.slug, b)) / 2;
      expect(t.score).toBeCloseTo(expected, 10);
    }
  });

  it("weights every Observer equally rather than pooling their words", () => {
    // Pooling would score the union of both word lists once, so an Observer who
    // picks more words would contribute more. Equal-weight averaging must not
    // behave that way: `dan` earns points only from A, so its equal-weight
    // score is exactly half A's solo dan score — and strictly below the pooled
    // score, which is unchanged by B (B adds no dan words).
    const out = aggregateObservers([OBS_A, OBS_B]);
    const soloA = score(OBS_A);
    const pooled = score([...OBS_A, ...OBS_B]);

    expect(scoreOf("dan", out)).toBeCloseTo(scoreOf("dan", soloA) / 2, 10);
    expect(scoreOf("dan", out)).toBeLessThan(scoreOf("dan", pooled));
  });

  it("unlocks the report at three Observers", () => {
    expect(MIN_OBSERVERS_FOR_REPORT).toBe(3);
  });
});
