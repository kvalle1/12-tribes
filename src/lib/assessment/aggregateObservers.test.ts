import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  averageProfiles,
  compareProfiles,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "./aggregateObservers";

const scoreFor = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

// Two observers who pick very different numbers of words. Used to prove the
// aggregation averages per-observer *normalized* profiles rather than pooling
// everyone's words into one bag (where the wordier observer would dominate).
const WORDY_OBSERVER = [
  "Courageous", // judah
  "Authoritative", // judah
  "Bold", // judah, reuben
  "Analytical", // issachar
  "Cautious", // dan, issachar
  "Alert", // dan
  "Creative", // naphtali
  "Comforting", // asher
];
const SPARSE_OBSERVER = [
  "Courageous", // judah
  "Convicted", // simeon
];

describe("aggregateObservers", () => {
  it("returns a score for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([WORDY_OBSERVER, SPARSE_OBSERVER]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
  });

  it("returns an all-zero profile when there are no observers", () => {
    const others = aggregateObservers([]);
    expect(others).toHaveLength(12);
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the observer's own normalized profile for a single observer", () => {
    const others = aggregateObservers([WORDY_OBSERVER]);
    const self = score(WORDY_OBSERVER);
    for (const t of tribes) {
      expect(scoreFor(t.slug, others)).toBeCloseTo(scoreFor(t.slug, self));
    }
  });

  it("is the equal-weight average of each observer's normalized scores", () => {
    // The central ADR-0003 invariant: each observer contributes their own
    // normalized profile, and the "others" profile is the plain mean of those
    // profiles — every observer weighted the same regardless of word count.
    const others = aggregateObservers([WORDY_OBSERVER, SPARSE_OBSERVER]);
    const a = score(WORDY_OBSERVER);
    const b = score(SPARSE_OBSERVER);
    for (const t of tribes) {
      const expected = (scoreFor(t.slug, a) + scoreFor(t.slug, b)) / 2;
      expect(scoreFor(t.slug, others)).toBeCloseTo(expected);
    }
  });

  it("does not pool words — a wordier observer does not gain more influence", () => {
    // Pooling both observers' words into one selection would let the wordier
    // observer dominate; equal-weight averaging must differ from that for at
    // least one tribe.
    const equalWeight = aggregateObservers([WORDY_OBSERVER, SPARSE_OBSERVER]);
    const pooled = score([...WORDY_OBSERVER, ...SPARSE_OBSERVER]);
    const diverges = tribes.some(
      (t) =>
        Math.abs(scoreFor(t.slug, equalWeight) - scoreFor(t.slug, pooled)) >
        1e-9,
    );
    expect(diverges).toBe(true);
  });

  it("ignores unknown and duplicate words within each observer (via score)", () => {
    const clean = aggregateObservers([SPARSE_OBSERVER]);
    const noisy = aggregateObservers([
      [...SPARSE_OBSERVER, "notaword", "Courageous"],
    ]);
    for (const t of tribes) {
      expect(scoreFor(t.slug, noisy)).toBeCloseTo(scoreFor(t.slug, clean));
    }
  });
});

describe("averageProfiles", () => {
  it("is the plain per-tribe mean of already-scored profiles", () => {
    const a = score(WORDY_OBSERVER);
    const b = score(SPARSE_OBSERVER);
    const avg = averageProfiles([a, b]);
    for (const t of tribes) {
      const expected = (scoreFor(t.slug, a) + scoreFor(t.slug, b)) / 2;
      expect(scoreFor(t.slug, avg)).toBeCloseTo(expected);
    }
  });

  it("matches aggregateObservers when fed the same observers' scores", () => {
    // aggregateObservers is defined as averageProfiles over per-observer scores,
    // so scoring once and averaging must equal scoring inside the aggregation.
    const viaWords = aggregateObservers([WORDY_OBSERVER, SPARSE_OBSERVER]);
    const viaProfiles = averageProfiles([
      score(WORDY_OBSERVER),
      score(SPARSE_OBSERVER),
    ]);
    for (const t of tribes) {
      expect(scoreFor(t.slug, viaProfiles)).toBeCloseTo(
        scoreFor(t.slug, viaWords),
      );
    }
  });

  it("returns an all-zero profile for no profiles", () => {
    expect(averageProfiles([]).every((s) => s.score === 0)).toBe(true);
  });
});

describe("isReportUnlocked", () => {
  it("locks below the minimum observer count", () => {
    expect(isReportUnlocked(0)).toBe(false);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT - 1)).toBe(false);
  });

  it("unlocks at and above the minimum observer count", () => {
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT)).toBe(true);
    expect(isReportUnlocked(MIN_OBSERVERS_FOR_REPORT + 1)).toBe(true);
  });
});

describe("compareProfiles", () => {
  it("pairs self and others per tribe with a self-minus-others delta", () => {
    const self = score(WORDY_OBSERVER);
    const others = aggregateObservers([SPARSE_OBSERVER]);
    const rows = compareProfiles(self, others);

    expect(rows.map((r) => r.slug)).toEqual(tribes.map((t) => t.slug));
    for (const r of rows) {
      expect(r.self).toBeCloseTo(scoreFor(r.slug, self));
      expect(r.others).toBeCloseTo(scoreFor(r.slug, others));
      expect(r.delta).toBeCloseTo(r.self - r.others);
    }
  });

  it("treats a tribe missing from the others profile as zero", () => {
    const self = score(["Courageous"]);
    const rows = compareProfiles(self, []);
    for (const r of rows) {
      expect(r.others).toBe(0);
      expect(r.delta).toBeCloseTo(r.self);
    }
  });
});
