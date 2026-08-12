import { describe, it, expect } from "vitest";
import type { TribeScore } from "@/lib/assessment/score";
import { compareProfiles, DIVERGENCE_THRESHOLD } from "./comparison";

const t = (slug: string, score: number): TribeScore => ({
  slug,
  name: slug,
  score,
});

describe("compareProfiles", () => {
  it("pairs self and others by tribe, matching on slug regardless of order", () => {
    const self = [t("a", 1), t("b", 0.5)];
    const others = [t("b", 0.25), t("a", 0.75)];
    const rows = compareProfiles(self, others);
    const a = rows.find((r) => r.slug === "a")!;
    expect(a.selfScore).toBe(1);
    expect(a.othersScore).toBe(0.75);
  });

  it("scales both bars against the single global max across both profiles", () => {
    const self = [t("a", 0.4), t("b", 0.2)];
    const others = [t("a", 0.1), t("b", 0.8)];
    const rows = compareProfiles(self, others);
    const b = rows.find((r) => r.slug === "b")!;
    // global max is 0.8 (others' b), so it fills the bar completely
    expect(b.othersFraction).toBeCloseTo(1, 10);
    expect(b.selfFraction).toBeCloseTo(0.2 / 0.8, 10);
  });

  it("sorts rows by the stronger of the two fractions, descending", () => {
    const self = [t("a", 0.1), t("b", 0.9), t("c", 0.3)];
    const others = [t("a", 0.5), t("b", 0.2), t("c", 0.3)];
    const rows = compareProfiles(self, others);
    expect(rows.map((r) => r.slug)).toEqual(["b", "a", "c"]);
  });

  it("flags a tribe as diverging when the self/others gap crosses the threshold", () => {
    const self = [t("a", 1), t("b", 1)];
    const others = [t("a", 1), t("b", 0)];
    const rows = compareProfiles(self, others);
    expect(rows.find((r) => r.slug === "a")!.diverges).toBe(false);
    const b = rows.find((r) => r.slug === "b")!;
    expect(b.gap).toBeGreaterThanOrEqual(DIVERGENCE_THRESHOLD);
    expect(b.diverges).toBe(true);
  });

  it("returns zero fractions when both profiles are empty", () => {
    const rows = compareProfiles([t("a", 0)], [t("a", 0)]);
    expect(rows[0].selfFraction).toBe(0);
    expect(rows[0].othersFraction).toBe(0);
    expect(rows[0].diverges).toBe(false);
  });
});
