import { describe, expect, it } from "vitest";
import { markerCatalog } from "./markers";
import { buildScoreTrace } from "./trace";
import type { InterviewTurn, ScoreTraceEntry } from "./types";

const entry = (
  turnIndex: number,
  markerId: string,
  tribeSlug: string,
  delta: number,
  type: ScoreTraceEntry["type"] = "strength",
  postureSignal: ScoreTraceEntry["postureSignal"] = "neutral",
): ScoreTraceEntry => ({ turnIndex, markerId, tribeSlug, type, delta, postureSignal });

const turn = (question: string, answer: string): InterviewTurn => ({ question, answer });

describe("buildScoreTrace", () => {
  it("returns nothing for an empty trace", () => {
    expect(buildScoreTrace([], [])).toEqual([]);
  });

  it("groups contributions by tribe and totals the deltas", () => {
    const turns = [turn("Q1", "A1"), turn("Q2", "A2")];
    const trace = [
      entry(0, "m-judah", "judah", 2),
      entry(1, "m-levi", "levi", 1),
      entry(1, "m-judah", "judah", 3),
    ];
    const result = buildScoreTrace(trace, turns);

    const judah = result.find((t) => t.tribeSlug === "judah");
    expect(judah?.total).toBe(5);
    expect(judah?.contributions).toHaveLength(2);
    expect(result.find((t) => t.tribeSlug === "levi")?.total).toBe(1);
  });

  it("orders tribes by total descending, breaking ties by slug", () => {
    const trace = [
      entry(0, "a", "levi", 2),
      entry(0, "b", "judah", 2),
      entry(0, "c", "dan", 5),
    ];
    const order = buildScoreTrace(trace, [turn("Q", "A")]).map((t) => t.tribeSlug);
    expect(order).toEqual(["dan", "judah", "levi"]);
  });

  it("keeps a tribe's contributions in Turn order", () => {
    const turns = [turn("Q1", "A1"), turn("Q2", "A2"), turn("Q3", "A3")];
    const trace = [
      entry(2, "m3", "judah", 1),
      entry(0, "m1", "judah", 1),
      entry(1, "m2", "judah", 1),
    ];
    const judah = buildScoreTrace(trace, turns)[0];
    expect(judah.contributions.map((c) => c.turnNumber)).toEqual([3, 1, 2]);
  });

  it("resolves a Marker's plain-language signal from the catalog", () => {
    const real = markerCatalog[0];
    const trace = [entry(0, real.id, real.tribeSlug, 2, real.type)];
    const [tribe] = buildScoreTrace(trace, [turn("Q", "A")]);
    expect(tribe.contributions[0].signal).toBe(real.signal);
  });

  it("falls back to the Marker id when the Marker is unknown", () => {
    const trace = [entry(0, "no-such-marker", "judah", 2)];
    const [tribe] = buildScoreTrace(trace, [turn("Q", "A")]);
    expect(tribe.contributions[0].signal).toBe("no-such-marker");
  });

  it("identifies each contribution by its question, not the raw answer text", () => {
    const turns = [turn("What drives you?", "DEEPLY_PERSONAL_CONFESSION")];
    const trace = [entry(0, "m", "judah", 2)];
    const result = buildScoreTrace(trace, turns);

    expect(result[0].contributions[0].question).toBe("What drives you?");
    expect(result[0].contributions[0].turnNumber).toBe(1);
    // The raw answer text must never appear anywhere in the trace view model.
    expect(JSON.stringify(result)).not.toContain("DEEPLY_PERSONAL_CONFESSION");
  });

  it("tolerates a trace entry whose Turn is out of range", () => {
    const trace = [entry(7, "m", "judah", 2)];
    const [tribe] = buildScoreTrace(trace, [turn("Q", "A")]);
    expect(tribe.contributions[0].question).toBe("");
    expect(tribe.contributions[0].turnNumber).toBe(8);
  });

  it("carries the delta, type, and posture signal through for display", () => {
    const trace = [entry(0, "m", "judah", 3, "fallLine", "integrated")];
    const [tribe] = buildScoreTrace(trace, [turn("Q", "A")]);
    expect(tribe.contributions[0]).toMatchObject({
      delta: 3,
      type: "fallLine",
      postureSignal: "integrated",
    });
  });
});
