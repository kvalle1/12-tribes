import { describe, expect, it } from "vitest";
import { MAX_TURNS, MIN_TURNS } from "./confidence";
import { CALIBRATION_TURNS } from "./funnel";
import { interviewProgress } from "./progress";

describe("interviewProgress", () => {
  it("starts empty before any answer", () => {
    const p = interviewProgress(0);
    expect(p.answered).toBe(0);
    expect(p.fraction).toBe(0);
    expect(p.minReached).toBe(false);
    expect(p.phase).toBe("calibration");
  });

  it("reports the calibration phase during the opening Turns and discrimination after", () => {
    expect(interviewProgress(CALIBRATION_TURNS - 1).phase).toBe("calibration");
    expect(interviewProgress(CALIBRATION_TURNS).phase).toBe("discrimination");
  });

  it("marks the floor reached only once the minimum Turns are answered", () => {
    expect(interviewProgress(MIN_TURNS - 1).minReached).toBe(false);
    expect(interviewProgress(MIN_TURNS).minReached).toBe(true);
  });

  it("never fills completely while in progress — no fixed-length implication", () => {
    for (let answered = 0; answered <= MAX_TURNS + 5; answered++) {
      const { fraction } = interviewProgress(answered);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThan(1);
    }
  });

  it("grows monotonically with each answer", () => {
    let last = -1;
    for (let answered = 0; answered <= MAX_TURNS + 5; answered++) {
      const { fraction } = interviewProgress(answered);
      expect(fraction).toBeGreaterThanOrEqual(last);
      last = fraction;
    }
  });

  it("clamps the fill past the cap so it cannot creep to full", () => {
    const atCap = interviewProgress(MAX_TURNS).fraction;
    const beyond = interviewProgress(MAX_TURNS + 10).fraction;
    expect(beyond).toBe(atCap);
    expect(atCap).toBeLessThan(1);
  });

  it("gives a length-agnostic label that never names a total count", () => {
    for (let answered = 0; answered <= MAX_TURNS; answered++) {
      const { label } = interviewProgress(answered);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/\bof\b|\/|\d/); // no "N of M", "N/M", or digits
    }
  });

  it("moves the label through getting-started → acquainting → narrowing", () => {
    expect(interviewProgress(0).label).toMatch(/start/i);
    expect(interviewProgress(1).label).not.toBe(interviewProgress(0).label);
    expect(interviewProgress(MIN_TURNS).label).toMatch(/narrow/i);
  });
});
