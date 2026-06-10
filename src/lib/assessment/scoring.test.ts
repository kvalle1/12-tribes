import { describe, it, expect } from "vitest";
import { tribes } from "../tribes";
import { score, deriveResult } from "./scoring";

describe("score", () => {
  it("returns a 0–1 value for every tribe", () => {
    const scores = score(["Courageous"]);
    expect(Object.keys(scores).sort()).toEqual(
      tribes.map((t) => t.slug).sort(),
    );
    for (const value of Object.values(scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("scores all tribes 0 for an empty selection", () => {
    const scores = score([]);
    expect(Object.values(scores).every((v) => v === 0)).toBe(true);
  });

  it("splits a shared word 0.5 to each of its tribes", () => {
    // Generous → Zebulun (available 4.5) + Asher (available 7.0), shared.
    const scores = score(["Generous"]);
    expect(scores.zebulun).toBeCloseTo(0.5 / 4.5);
    expect(scores.asher).toBeCloseTo(0.5 / 7.0);
  });

  it("gives a sole-mapped word the full 1.0 weight", () => {
    // Courageous → Judah only (available 6.5).
    const scores = score(["Courageous"]);
    expect(scores.judah).toBeCloseTo(1 / 6.5);
  });

  it("normalizes by coverage so low- and high-coverage tribes compete fairly", () => {
    // Both selections are one sole-mapped word (raw 1.0 point), but Reuben has
    // fewer available points than Issachar, so it should score higher.
    const reuben = score(["Energetic"]).reuben; // Reuben available 4.5
    const issachar = score(["Analytical"]).issachar; // Issachar available 8.5
    expect(reuben).toBeGreaterThan(issachar);

    // Selecting every word a tribe maps to yields a perfect 1.0 regardless of
    // how many words that tribe has — the essence of coverage-fair scoring.
    const allZebulun = score([
      "Enterprising",
      "Expansive",
      "Generous",
      "Prosperous",
      "Resourceful",
    ]);
    expect(allZebulun.zebulun).toBeCloseTo(1);
  });

  it("counts a duplicated selection only once", () => {
    expect(score(["Courageous", "Courageous"]).judah).toBeCloseTo(1 / 6.5);
  });

  it("ignores words not in the list", () => {
    const scores = score(["Flibbertigibbet"]);
    expect(Object.values(scores).every((v) => v === 0)).toBe(true);
  });
});

describe("deriveResult", () => {
  it("always returns a Primary, even for an all-zero selection", () => {
    const result = deriveResult(score([]));
    expect(result.primary).toBeTruthy();
    expect(tribes.some((t) => t.slug === result.primary)).toBe(true);
    expect(result.secondary).toBeNull();
  });

  it("returns the top scorer as Primary", () => {
    // Naphtali words dominate.
    const result = deriveResult(
      score(["Creative", "Expressive", "Free-spirited"]),
    );
    expect(result.primary).toBe("naphtali");
  });

  it("returns a Secondary when it is near Primary and clearly ahead of the third", () => {
    // Naphtali 0.5 (primary), Zebulun ≈0.444 (near, within 20%), all others 0.
    const result = deriveResult(
      score(["Creative", "Expressive", "Free-spirited", "Enterprising", "Expansive"]),
    );
    expect(result.primary).toBe("naphtali");
    expect(result.secondary).toBe("zebulun");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    // Naphtali 1.0 (all six words); Zebulun only ≈0.222 — far behind.
    const result = deriveResult(
      score([
        "Creative",
        "Expressive",
        "Free-spirited",
        "Graceful",
        "Healing",
        "Inspiring",
        "Enterprising",
      ]),
    );
    expect(result.primary).toBe("naphtali");
    expect(result.secondary).toBeNull();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    // Naphtali 0.5; Zebulun ≈0.444 and Reuben ≈0.444 — runner-up not clearly
    // ahead of the third, so no Secondary.
    const result = deriveResult(
      score([
        "Creative",
        "Expressive",
        "Free-spirited",
        "Enterprising",
        "Expansive",
        "Energetic",
        "Impulsive",
      ]),
    );
    expect(result.primary).toBe("naphtali");
    expect(result.secondary).toBeNull();
  });
});
