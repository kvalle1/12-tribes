import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  score,
  deriveResult,
  type TribeScore,
} from "@/lib/assessment/score";

/** Convenience: pull one tribe's normalized score out of a score() result. */
function scoreFor(result: TribeScore[], slug: string): number {
  const entry = result.find((s) => s.slug === slug);
  if (!entry) throw new Error(`no score for ${slug}`);
  return entry.score;
}

/** Build a synthetic score array, defaulting every unlisted tribe to 0. */
function scores(overrides: Record<string, number>): TribeScore[] {
  return tribes.map((t) => ({ slug: t.slug, score: overrides[t.slug] ?? 0 }));
}

describe("score()", () => {
  it("returns one normalized 0–1 entry per tribe", () => {
    const result = score(["Courageous"]);
    expect(result).toHaveLength(tribes.length);
    for (const { score: s } of result) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // "Bold" → Judah (available 6.5) + Reuben (available 4.5), 0.5 to each.
    const result = score(["Bold"]);
    expect(scoreFor(result, "judah")).toBeCloseTo(0.5 / 6.5, 10);
    expect(scoreFor(result, "reuben")).toBeCloseTo(0.5 / 4.5, 10);
    // No other tribe earns anything from a single shared word.
    for (const { slug, score: s } of result) {
      if (slug !== "judah" && slug !== "reuben") expect(s).toBe(0);
    }
  });

  it("splits a three-way shared word 0.5 to each tribe", () => {
    // "Zealous" → Judah (6.5), Benjamin (6.5), Simeon (6.0), 0.5 to each.
    const result = score(["Zealous"]);
    expect(scoreFor(result, "judah")).toBeCloseTo(0.5 / 6.5, 10);
    expect(scoreFor(result, "benjamin")).toBeCloseTo(0.5 / 6.5, 10);
    expect(scoreFor(result, "simeon")).toBeCloseTo(0.5 / 6.0, 10);
  });

  it("normalizes by each tribe's available points so coverage is fair", () => {
    // The same single, full-weight word earns proportionally more for a tribe
    // with fewer available points. Naphtali has 6 available; Issachar has 8.5.
    const naphtali = scoreFor(score(["Creative"]), "naphtali"); // 1 / 6
    const issachar = scoreFor(score(["Analytical"]), "issachar"); // 1 / 8.5
    expect(naphtali).toBeCloseTo(1 / 6, 10);
    expect(issachar).toBeCloseTo(1 / 8.5, 10);
    // Equal raw contribution (1 point) → higher normalized score for the
    // smaller-coverage tribe. Neither is penalized for its coverage.
    expect(naphtali).toBeGreaterThan(issachar);
  });

  it("ignores unknown words", () => {
    expect(score(["definitely-not-a-word"]).every((s) => s.score === 0)).toBe(true);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary (the highest score)", () => {
    const result = deriveResult(scores({ joseph: 0.7, asher: 0.3 }));
    expect(result.primary.slug).toBe("joseph");
  });

  it("returns a Secondary when it is near Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.9, simeon: 0.5 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary?.slug).toBe("benjamin");
  });

  it("hides the Secondary when the runner-up is far behind the Primary", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.6, simeon: 0.4 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("hides the Secondary when the runner-up is ~tied with the third tribe", () => {
    const result = deriveResult(
      scores({ judah: 1.0, benjamin: 0.9, simeon: 0.85 }),
    );
    expect(result.primary.slug).toBe("judah");
    expect(result.secondary).toBeUndefined();
  });

  it("breaks ties deterministically by tribe number", () => {
    // Judah (#1) and Levi (#2) tie for top; Judah wins on number.
    const result = deriveResult(scores({ judah: 0.9, levi: 0.9, issachar: 0.2 }));
    expect(result.primary.slug).toBe("judah");
    // Levi qualifies as Secondary: equal to Primary, clearly ahead of third.
    expect(result.secondary?.slug).toBe("levi");
  });

  it("integrates with score(): selecting words yields a sensible headline", () => {
    // Judah-leaning selection: Authoritative, Courageous, Honorable, Sacrificial
    // are all Judah-unique full-weight words.
    const result = deriveResult(
      score(["Authoritative", "Courageous", "Honorable", "Sacrificial"]),
    );
    expect(result.primary.slug).toBe("judah");
  });
});
