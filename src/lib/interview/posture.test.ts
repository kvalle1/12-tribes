import { describe, expect, it } from "vitest";
import {
  arcFraming,
  classifyArc,
  POSTURE_ARC_THRESHOLD,
  summarizePosture,
} from "./posture";
import type { ScoreTraceEntry } from "./types";

const t = (
  tribeSlug: string,
  type: ScoreTraceEntry["type"],
  delta: number,
  postureSignal: ScoreTraceEntry["postureSignal"],
  turnIndex = 0,
  markerId = `${tribeSlug}-m`,
): ScoreTraceEntry => ({ turnIndex, markerId, tribeSlug, type, delta, postureSignal });

describe("classifyArc", () => {
  it("is 'unknown' when there is no posture-bearing evidence", () => {
    expect(classifyArc(0, 0)).toBe("unknown");
  });

  it("is 'integrated' when evidence leans past the threshold toward integrated", () => {
    expect(classifyArc(0, 3)).toBe("integrated");
    expect(classifyArc(1, 2)).toBe("integrated"); // 2:1 lean just tips
  });

  it("is 'active-shadow' when evidence leans past the threshold toward shadow", () => {
    expect(classifyArc(3, 0)).toBe("active-shadow");
    expect(classifyArc(2, 1)).toBe("active-shadow");
  });

  it("is 'mixed' when the evidence pulls both ways without a clear lean", () => {
    expect(classifyArc(2, 2)).toBe("mixed");
    expect(classifyArc(3, 2)).toBe("mixed"); // below the threshold either way
  });

  it("uses the same threshold on both poles", () => {
    // A split exactly at the threshold tips; just under it stays mixed.
    const bearing = 6;
    const integrated = (bearing * (1 + POSTURE_ARC_THRESHOLD)) / 2;
    expect(classifyArc(bearing - integrated, integrated)).toBe("integrated");
  });
});

describe("summarizePosture", () => {
  it("accumulates active-shadow and integrated weight per tribe", () => {
    const posture = summarizePosture([
      t("judah", "shadow", 2, "active-shadow"),
      t("judah", "oil", 2, "integrated"),
      t("judah", "fallLine", 1, "active-shadow"),
      t("levi", "oil", 3, "integrated"),
    ]);
    // judah: 3 active-shadow vs 2 integrated → below the lean threshold → mixed.
    expect(posture.judah).toEqual({ activeShadow: 3, integrated: 2, arc: "mixed" });
    expect(posture.levi).toEqual({ activeShadow: 0, integrated: 3, arc: "integrated" });
  });

  it("ignores neutral signals — they drive strength, never posture (ADR-0004)", () => {
    const posture = summarizePosture([
      t("dan", "strength", 2, "neutral"),
      t("dan", "strength", 1, "neutral"),
    ]);
    expect(posture.dan).toEqual({ activeShadow: 0, integrated: 0, arc: "unknown" });
  });

  it("returns an empty profile for an empty trace", () => {
    expect(summarizePosture([])).toEqual({});
  });

  it("places a tribe with only matured (integrated) evidence on the integrated arc", () => {
    const posture = summarizePosture([t("simeon", "oil", 2, "integrated")]);
    expect(posture.simeon.arc).toBe("integrated");
  });
});

describe("arcFraming", () => {
  it("gives a disqualified tribe on the active-shadow arc a cautionary, non-condemning reading", () => {
    const copy = arcFraming("disqualified", "active-shadow");
    expect(copy).toBeTruthy();
    expect(copy.toLowerCase()).not.toContain("rejected");
    expect(copy.toLowerCase()).toContain("caution");
  });

  it("gives a disqualified tribe on the integrated arc a redemption reading", () => {
    const copy = arcFraming("disqualified", "integrated");
    expect(copy.toLowerCase()).toContain("redempt");
  });

  it("frames a warning tribe without condemnation", () => {
    const copy = arcFraming("warning", "mixed");
    expect(copy).toBeTruthy();
    expect(copy.toLowerCase()).not.toContain("rejected");
  });

  it("returns empty copy for an active tribe (no status-aware framing needed)", () => {
    expect(arcFraming("active", "integrated")).toBe("");
  });
});
