import { describe, it, expect } from "vitest";
import { score, deriveResult, type TribeScores } from "./scoring";

/** Build a full score map from a sparse set of slug→score overrides. */
function scores(overrides: TribeScores): TribeScores {
  const base: TribeScores = {
    judah: 0,
    levi: 0,
    issachar: 0,
    zebulun: 0,
    joseph: 0,
    benjamin: 0,
    dan: 0,
    naphtali: 0,
    asher: 0,
    gad: 0,
    reuben: 0,
    simeon: 0,
  };
  return { ...base, ...overrides };
}

describe("score()", () => {
  it("returns a normalized 0–1 value for every tribe", () => {
    const result = score(["Authoritative"]);
    expect(Object.keys(result)).toHaveLength(12);
    for (const v of Object.values(result)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("splits a shared word 0.5 to each tribe (vs a full point for a solo word)", () => {
    // "Courageous" is solo→judah (weight 1); "Bold" is shared judah·reuben
    // (weight 0.5 to judah). With the same judah denominator, the solo word
    // must yield exactly twice the judah score of the shared word.
    const solo = score(["Courageous"]).judah;
    const shared = score(["Bold"]).judah;
    expect(solo).toBeCloseTo(2 * shared, 10);
    expect(shared).toBeGreaterThan(0);
  });

  it("normalizes by available points so different-sized tribes compete fairly", () => {
    // Levi (6 words) and Issachar (more words) both reach 1.0 at full coverage.
    const leviWords = [
      "Dedicated",
      "Devoted",
      "Exacting",
      "Guarding",
      "Precise",
      "Reverent",
    ];
    const issacharWords = [
      "Analytical",
      "Cautious",
      "Discerning",
      "Insightful",
      "Learned",
      "Measured",
      "Observant",
      "Patient",
      "Perceptive",
      "Strategic",
      "Wise",
    ];
    expect(score(leviWords).levi).toBeCloseTo(1, 10);
    expect(score(issacharWords).issachar).toBeCloseTo(1, 10);
  });

  it("ignores unknown selected words", () => {
    expect(score(["NotAWord"]).judah).toBe(0);
  });
});

describe("deriveResult()", () => {
  it("always returns a Primary for a non-empty selection", () => {
    const result = deriveResult(score(["Authoritative", "Courageous"]));
    expect(result.primary).toBe("judah");
  });

  it("returns no Primary when nothing scores above zero", () => {
    expect(deriveResult(scores({}))).toEqual({
      primary: null,
      secondary: null,
    });
  });

  it("returns a Secondary when it is near the Primary and clearly ahead of the third", () => {
    const result = deriveResult(
      scores({ judah: 1.0, dan: 0.9, gad: 0.2 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBe("dan");
  });

  it("hides the Secondary when it is far behind the Primary", () => {
    const result = deriveResult(
      scores({ judah: 1.0, dan: 0.5, gad: 0.2 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("hides the Secondary when it is ~tied with the third tribe", () => {
    const result = deriveResult(
      scores({ judah: 1.0, dan: 0.9, gad: 0.85 }),
    );
    expect(result.primary).toBe("judah");
    expect(result.secondary).toBeNull();
  });

  it("breaks Primary ties deterministically by tribe number", () => {
    // judah (#1) and simeon (#12) tie; judah wins on the lower number.
    const result = deriveResult(scores({ judah: 0.5, simeon: 0.5 }));
    expect(result.primary).toBe("judah");
  });
});
