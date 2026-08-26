import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import { score, type TribeScore } from "./score";
import {
  aggregateObservers,
  averageProfiles,
  scoreObserverSelections,
  MIN_OBSERVERS,
} from "./aggregate";

const at = (slug: string, scores: TribeScore[]) =>
  scores.find((s) => s.slug === slug)!.score;

/**
 * Two selections chosen so that pooling and averaging give provably different
 * answers: A is judah-heavy (no asher), B is pure asher (no judah). Pooling the
 * words leaves judah at its A-only level, while equal-weight averaging halves it
 * — so the two strategies must diverge on judah and asher.
 */
const A = ["Courageous", "Authoritative", "Bold"]; // judah-heavy (+reuben via Bold)
const B = ["Comforting", "Enriching"]; // pure asher

describe("aggregateObservers", () => {
  it("returns a normalized profile for all 12 tribes in canonical order", () => {
    const others = aggregateObservers([A, B]);
    expect(others).toHaveLength(12);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    for (const s of others) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("returns an all-zero canonical profile for no observers", () => {
    const others = aggregateObservers([]);
    expect(others.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(others.every((s) => s.score === 0)).toBe(true);
  });

  it("equals the single observer's own normalized profile when there is one", () => {
    const others = aggregateObservers([A]);
    const solo = score(A);
    for (const tribe of tribes) {
      expect(at(tribe.slug, others)).toBeCloseTo(at(tribe.slug, solo), 10);
    }
  });

  it("is the equal-weight average of each observer's individually-normalized profile", () => {
    const others = aggregateObservers([A, B]);
    const sa = score(A);
    const sb = score(B);
    for (const tribe of tribes) {
      const expected = (at(tribe.slug, sa) + at(tribe.slug, sb)) / 2;
      expect(at(tribe.slug, others)).toBeCloseTo(expected, 10);
    }
  });

  it("averages normalized profiles rather than pooling everyone's words", () => {
    const others = aggregateObservers([A, B]);
    const pooled = score([...A, ...B]);
    // Pooling keeps judah at its A-only level; averaging halves it. They must differ.
    expect(at("judah", others)).toBeGreaterThan(0);
    expect(at("judah", others)).not.toBeCloseTo(at("judah", pooled), 6);
    expect(at("judah", others)).toBeCloseTo(at("judah", score(A)) / 2, 10);
  });

  it("does not let an observer who picks more words gain more influence", () => {
    // A "heavy" observer selects far more words than a "light" one, but their
    // read of a tribe the heavy observer never picked (asher) still counts for
    // exactly half of the two-observer average — undiluted by word count.
    const heavy = [
      "Courageous",
      "Authoritative",
      "Bold",
      "Analytical",
      "Energetic",
      "Dedicated",
      "Devoted",
    ];
    const light = ["Comforting", "Enriching"]; // pure asher, far fewer words
    expect(heavy.length).toBeGreaterThan(light.length);
    expect(at("asher", score(heavy))).toBe(0); // heavy observer says nothing about asher

    const others = aggregateObservers([heavy, light]);
    expect(at("asher", others)).toBeCloseTo(at("asher", score(light)) / 2, 10);
    expect(at("asher", others)).toBeGreaterThan(0);
  });
});

describe("scoreObserverSelections", () => {
  it("scores each observer individually, preserving input order", () => {
    const profiles = scoreObserverSelections([A, B]);
    expect(profiles).toHaveLength(2);
    for (const tribe of tribes) {
      expect(at(tribe.slug, profiles[0])).toBeCloseTo(at(tribe.slug, score(A)), 10);
      expect(at(tribe.slug, profiles[1])).toBeCloseTo(at(tribe.slug, score(B)), 10);
    }
  });
});

describe("averageProfiles", () => {
  it("joins by slug so input ordering does not matter", () => {
    const canonical = score(A);
    const shuffled = [...score(A)].reverse();
    const avgA = averageProfiles([canonical]);
    const avgB = averageProfiles([shuffled]);
    for (const tribe of tribes) {
      expect(at(tribe.slug, avgA)).toBeCloseTo(at(tribe.slug, avgB), 10);
    }
  });

  it("returns an all-zero canonical profile for an empty set", () => {
    const avg = averageProfiles([]);
    expect(avg.map((s) => s.slug)).toEqual(tribes.map((t) => t.slug));
    expect(avg.every((s) => s.score === 0)).toBe(true);
  });
});

describe("MIN_OBSERVERS", () => {
  it("is the ADR-0003 unlock floor of 3", () => {
    expect(MIN_OBSERVERS).toBe(3);
  });
});
