import { describe, expect, it } from "vitest";
import { interviewProgress } from "./progress";

// Representative bounds (the page wires in the real MIN_TURNS/MAX_TURNS).
const FLOOR = 6;
const CAP = 18;

describe("interviewProgress", () => {
  it("is empty at the start", () => {
    expect(interviewProgress(0, FLOOR, CAP).fraction).toBe(0);
    expect(interviewProgress(0, FLOOR, CAP).phase).toBe("warming-up");
  });

  it("never reaches 100% while a question is still pending", () => {
    for (let answered = 0; answered <= CAP + 5; answered++) {
      expect(interviewProgress(answered, FLOOR, CAP).fraction).toBeLessThan(1);
    }
  });

  it("is non-decreasing as more questions are answered", () => {
    let last = -1;
    for (let answered = 0; answered <= CAP; answered++) {
      const { fraction } = interviewProgress(answered, FLOOR, CAP);
      expect(fraction).toBeGreaterThanOrEqual(last);
      last = fraction;
    }
  });

  it("has filled a majority of the bar by the minimum floor", () => {
    expect(interviewProgress(FLOOR, FLOOR, CAP).fraction).toBeGreaterThanOrEqual(0.7);
  });

  it("clamps at a ceiling below 1, even past the cap", () => {
    const atCeiling = interviewProgress(CAP, FLOOR, CAP).fraction;
    expect(atCeiling).toBeLessThan(1);
    expect(interviewProgress(CAP + 10, FLOOR, CAP).fraction).toBe(atCeiling);
  });

  it("moves through warming-up → homing-in → almost-there", () => {
    expect(interviewProgress(1, FLOOR, CAP).phase).toBe("warming-up");
    expect(interviewProgress(FLOOR, FLOOR, CAP).phase).toBe("homing-in");
    expect(interviewProgress(CAP - 1, FLOOR, CAP).phase).toBe("almost-there");
  });

  it("treats a negative answered count as zero", () => {
    expect(interviewProgress(-3, FLOOR, CAP).fraction).toBe(0);
  });

  it("does not divide by zero when the floor equals the cap", () => {
    const { fraction } = interviewProgress(8, 6, 6);
    expect(Number.isFinite(fraction)).toBe(true);
    expect(fraction).toBeGreaterThanOrEqual(0.7);
    expect(fraction).toBeLessThan(1);
  });
});
