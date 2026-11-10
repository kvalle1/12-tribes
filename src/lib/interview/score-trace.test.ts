import { describe, expect, it } from "vitest";
import { buildTribeTraces } from "./score-trace";
import type { InterviewTurn, ScoreTraceEntry } from "./types";

/** Minimal Marker lookup for tests — maps a few ids to type + signal. */
const resolve = (id: string) =>
  (
    ({
      "judah-strength-front": { type: "strength", signal: "Steps to the front." },
      "judah-oil-responsibility": { type: "oil", signal: "Comes alive under pressure." },
      "levi-strength-guard": { type: "strength", signal: "Guards what is holy." },
    }) as const
  )[id];

const turn = (question: string, answer = "an answer"): InterviewTurn => ({ question, answer });

const entry = (
  turnIndex: number,
  markerId: string,
  tribeSlug: string,
  type: ScoreTraceEntry["type"],
  delta: number,
): ScoreTraceEntry => ({ turnIndex, markerId, tribeSlug, type, delta, postureSignal: "neutral" });

describe("buildTribeTraces", () => {
  const turns = [turn("Q1 — who are you?"), turn("Q2 — under pressure?"), turn("Q3 — holy?")];

  it("groups contributions by tribe and sums each tribe's total", () => {
    const trace = [
      entry(0, "judah-strength-front", "judah", "strength", 1),
      entry(1, "judah-oil-responsibility", "judah", "oil", 2),
      entry(2, "levi-strength-guard", "levi", "strength", 1),
    ];
    const traces = buildTribeTraces(trace, turns, resolve);
    const judah = traces.find((t) => t.tribeSlug === "judah");
    const levi = traces.find((t) => t.tribeSlug === "levi");
    expect(judah?.total).toBe(3);
    expect(judah?.contributions).toHaveLength(2);
    expect(levi?.total).toBe(1);
  });

  it("resolves each contribution to the question shown and the Marker's signal (answer → Marker → delta)", () => {
    const trace = [entry(1, "judah-oil-responsibility", "judah", "oil", 2)];
    const [judah] = buildTribeTraces(trace, turns, resolve);
    expect(judah.contributions[0]).toEqual({
      questionNumber: 2,
      question: "Q2 — under pressure?",
      markerType: "oil",
      signal: "Comes alive under pressure.",
      delta: 2,
    });
  });

  it("never exposes the raw answer text (privacy — issue #10)", () => {
    const secret = "my deeply personal confession";
    const trace = [entry(0, "judah-strength-front", "judah", "strength", 1)];
    const traces = buildTribeTraces(trace, [turn("Q1", secret)], resolve);
    expect(JSON.stringify(traces)).not.toContain(secret);
  });

  it("never exposes the Marker id (scoring internal — issue #21)", () => {
    const trace = [entry(0, "judah-strength-front", "judah", "strength", 1)];
    const traces = buildTribeTraces(trace, turns, resolve);
    expect(JSON.stringify(traces)).not.toContain("judah-strength-front");
  });

  it("orders contributions oldest-first within a tribe", () => {
    const trace = [
      entry(1, "judah-oil-responsibility", "judah", "oil", 2),
      entry(0, "judah-strength-front", "judah", "strength", 1),
    ];
    const [judah] = buildTribeTraces(trace, turns, resolve);
    expect(judah.contributions.map((c) => c.questionNumber)).toEqual([1, 2]);
  });

  it("orders tribes by total strength, strongest first", () => {
    const trace = [
      entry(0, "judah-strength-front", "judah", "strength", 1),
      entry(2, "levi-strength-guard", "levi", "strength", 1),
      entry(1, "judah-oil-responsibility", "judah", "oil", 2),
    ];
    const traces = buildTribeTraces(trace, turns, resolve);
    expect(traces.map((t) => t.tribeSlug)).toEqual(["judah", "levi"]);
  });

  it("omits tribes with no contributions", () => {
    const traces = buildTribeTraces([], turns, resolve);
    expect(traces).toEqual([]);
  });

  it("skips an entry whose Marker no longer resolves rather than leaking a blank row", () => {
    const trace = [
      entry(0, "retired-marker", "judah", "strength", 1),
      entry(1, "judah-oil-responsibility", "judah", "oil", 2),
    ];
    const [judah] = buildTribeTraces(trace, turns, resolve);
    // Only the resolvable contribution survives; total reflects what is shown.
    expect(judah.contributions).toHaveLength(1);
    expect(judah.total).toBe(2);
  });

  it("omits a clamped zero-delta entry so no '+0' row and the total stays consistent", () => {
    const trace = [
      entry(0, "judah-strength-front", "judah", "strength", 0),
      entry(1, "judah-oil-responsibility", "judah", "oil", 2),
    ];
    const [judah] = buildTribeTraces(trace, turns, resolve);
    expect(judah.contributions).toHaveLength(1);
    expect(judah.contributions[0].questionNumber).toBe(2);
    expect(judah.total).toBe(2);
  });

  it("tolerates a trace entry that points past the recorded turns", () => {
    const trace = [entry(9, "judah-strength-front", "judah", "strength", 1)];
    const [judah] = buildTribeTraces(trace, turns, resolve);
    expect(judah.contributions[0].questionNumber).toBe(10);
    expect(typeof judah.contributions[0].question).toBe("string");
  });
});
