import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  deriveResult,
  emptyProfile,
  initialState,
  nextTurn,
  recordScoredAnswer,
} from "./flow";
import type { MarkerLookup } from "./scoring";
import type { ScoreDelta } from "./types";

const lookup: MarkerLookup = (id) =>
  id === "judah-strength"
    ? { tribeSlug: "judah", type: "strength", weight: 2 }
    : undefined;

const judahDelta: ScoreDelta = {
  markerId: "judah-strength",
  tribeSlug: "judah",
  type: "strength",
  delta: 2,
  postureSignal: "neutral",
};

describe("emptyProfile", () => {
  it("covers all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) {
      expect(profile[tribe.slug]).toBe(0);
    }
  });
});

describe("initialState / nextTurn", () => {
  it("parks the LLM opening question and presents it first", () => {
    const state = initialState("What feels most like you?");
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.trace).toEqual([]);
    expect(nextTurn(state)).toEqual({
      kind: "question",
      prompt: "What feels most like you?",
      questionNumber: 1,
    });
  });

  it("shows the result once complete", () => {
    const state = recordScoredAnswer(
      initialState("Q?"),
      "an answer",
      [judahDelta],
      lookup,
    );
    expect(nextTurn(state)).toEqual({ kind: "result" });
  });
});

describe("recordScoredAnswer", () => {
  it("records the answer against the pending question and folds in the score", () => {
    const state = recordScoredAnswer(initialState("Q?"), "I led the charge.", [judahDelta], lookup);
    expect(state.turns).toEqual([{ question: "Q?", answer: "I led the charge." }]);
    expect(state.profile.judah).toBe(2);
    expect(state.trace).toHaveLength(1);
    expect(state.trace[0].markerId).toBe("judah-strength");
    expect(state.status).toBe("complete");
    expect(state.pendingQuestion).toBeNull();
  });

  it("does not mutate the input state", () => {
    const before = initialState("Q?");
    recordScoredAnswer(before, "answer", [judahDelta], lookup);
    expect(before.turns).toEqual([]);
    expect(before.status).toBe("in_progress");
    expect(before.profile.judah).toBe(0);
  });

  it("is a no-op once the session is already complete", () => {
    const complete = recordScoredAnswer(initialState("Q?"), "first", [judahDelta], lookup);
    const again = recordScoredAnswer(complete, "second", [judahDelta], lookup);
    expect(again).toBe(complete);
    expect(again.turns).toHaveLength(1);
  });
});

describe("deriveResult", () => {
  it("returns the normalized profile and Primary for a completed session", () => {
    const complete = recordScoredAnswer(initialState("Q?"), "answer", [judahDelta], lookup);
    const result = deriveResult(complete);
    expect(result.primarySlug).toBe("judah");
    expect(result.normalized.judah).toBe(100); // only tribe with strength
  });

  it("refuses to produce a result before completion", () => {
    expect(() => deriveResult(initialState("Q?"))).toThrow();
  });
});
