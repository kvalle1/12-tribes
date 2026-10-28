import { describe, expect, it } from "vitest";
import { getMarkerById } from "./markers";
import { buildScoreTrace } from "./trace";
import type { ScoreTraceEntry } from "./types";

/** A trace entry with sensible defaults; override what the test cares about. */
const entry = (
  over: Partial<ScoreTraceEntry> & { tribeSlug: string; markerId: string },
): ScoreTraceEntry => ({
  turnIndex: 0,
  type: "strength",
  delta: 1,
  postureSignal: "neutral",
  ...over,
});

describe("buildScoreTrace", () => {
  it("groups contributions by tribe with a per-tribe total matching the applied deltas", () => {
    const result = buildScoreTrace([
      entry({ tribeSlug: "judah", markerId: "judah-strength-front", delta: 1, turnIndex: 0 }),
      entry({ tribeSlug: "judah", markerId: "judah-oil-responsibility", type: "oil", delta: 2, turnIndex: 1 }),
      entry({ tribeSlug: "levi", markerId: "levi-strength-guard", delta: 1, turnIndex: 0 }),
    ]);

    const judah = result.find((t) => t.tribeSlug === "judah");
    expect(judah?.total).toBe(3);
    expect(judah?.contributions).toHaveLength(2);

    const levi = result.find((t) => t.tribeSlug === "levi");
    expect(levi?.total).toBe(1);
  });

  it("maps each contribution to its answer's 1-based question number and the Marker's catalog signal", () => {
    const [judah] = buildScoreTrace([
      entry({ tribeSlug: "judah", markerId: "judah-strength-front", turnIndex: 2, delta: 1 }),
    ]);

    const contribution = judah.contributions[0];
    expect(contribution.questionNumber).toBe(3);
    expect(contribution.markerSignal).toBe(getMarkerById("judah-strength-front")?.signal);
    expect(contribution.delta).toBe(1);
  });

  it("orders tribes strongest-first by default, breaking ties by slug", () => {
    const result = buildScoreTrace([
      entry({ tribeSlug: "levi", markerId: "levi-strength-guard", delta: 1 }),
      entry({ tribeSlug: "judah", markerId: "judah-strength-front", delta: 3 }),
    ]);
    expect(result.map((t) => t.tribeSlug)).toEqual(["judah", "levi"]);
  });

  it("orders contributions within a tribe chronologically by question number", () => {
    const [judah] = buildScoreTrace([
      entry({ tribeSlug: "judah", markerId: "judah-oil-responsibility", type: "oil", turnIndex: 3, delta: 2 }),
      entry({ tribeSlug: "judah", markerId: "judah-strength-front", turnIndex: 1, delta: 1 }),
    ]);
    expect(judah.contributions.map((c) => c.questionNumber)).toEqual([2, 4]);
  });

  it("restricts to, and preserves the order of, the requested tribes", () => {
    const result = buildScoreTrace(
      [
        entry({ tribeSlug: "judah", markerId: "judah-strength-front", delta: 3 }),
        entry({ tribeSlug: "levi", markerId: "levi-strength-guard", delta: 1 }),
        entry({ tribeSlug: "dan", markerId: "dan-strength-judge", delta: 1 }),
      ],
      ["levi", "judah"],
    );
    expect(result.map((t) => t.tribeSlug)).toEqual(["levi", "judah"]);
  });

  it("never exposes raw answer text — a contribution carries only positional and catalog data", () => {
    const [judah] = buildScoreTrace([
      entry({ tribeSlug: "judah", markerId: "judah-strength-front", turnIndex: 0, delta: 1 }),
    ]);
    expect(Object.keys(judah.contributions[0]).sort()).toEqual(
      ["delta", "markerId", "markerSignal", "postureSignal", "questionNumber", "type"].sort(),
    );
  });

  it("falls back to a non-empty signal for an unknown marker id without throwing", () => {
    const [tribe] = buildScoreTrace([
      entry({ tribeSlug: "judah", markerId: "does-not-exist", delta: 1 }),
    ]);
    expect(tribe.contributions[0].markerSignal).toBeTruthy();
    expect(tribe.total).toBe(1);
  });

  it("returns an empty array for an empty trace", () => {
    expect(buildScoreTrace([])).toEqual([]);
  });
});
