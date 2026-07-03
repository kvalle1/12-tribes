import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { getMarkerById } from "./markers";
import type { ScoredDelta } from "./types";
import {
  INTERVIEW_TURN_CAP,
  OPENING_QUESTION,
  deriveInterviewResult,
  emptyProfile,
  initialState,
  nextTurn,
  recordScoredTurn,
} from "./flow";

function deltaFor(markerId: string, delta = 1): ScoredDelta {
  const marker = getMarkerById(markerId)!;
  return { markerId, tribeSlug: marker.tribeSlug, type: marker.type, delta, postureSignal: 0 };
}

/** Drive a Session forward one scored Turn with a given set of deltas. */
function answer(state = initialState(), deltas: ScoredDelta[] = [], next = "Next question?") {
  return recordScoredTurn(state, { answer: "an answer", deltas, nextQuestion: next });
}

describe("emptyProfile", () => {
  it("covers all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) expect(profile[tribe.slug]).toBe(0);
  });
});

describe("initialState / nextTurn", () => {
  it("starts in progress with no turns and the fixed opening question", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.trace).toEqual([]);
    expect(state.currentQuestion).toBe(OPENING_QUESTION);
  });

  it("presents the opening question first", () => {
    expect(nextTurn(initialState())).toEqual({
      kind: "question",
      prompt: OPENING_QUESTION,
      questionNumber: 1,
      totalQuestions: INTERVIEW_TURN_CAP,
    });
  });
});

describe("recordScoredTurn", () => {
  it("records the answer against the question that was being shown and shows the agent's next question", () => {
    const state = answer(initialState(), [deltaFor("judah-strength-front")], "What drives you?");
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].question).toBe(OPENING_QUESTION);
    expect(state.turns[0].deltas).toHaveLength(1);
    expect(state.currentQuestion).toBe("What drives you?");
    expect(nextTurn(state).kind).toBe("question");
    expect((nextTurn(state) as { prompt: string }).prompt).toBe("What drives you?");
  });

  it("applies cited deltas to the Strength Profile and accumulates the trace", () => {
    const marker = getMarkerById("judah-strength-front")!;
    const state = answer(initialState(), [deltaFor(marker.id, 1)]);
    expect(state.profile.judah).toBe(marker.weight);
    expect(state.trace).toHaveLength(1);
    expect(state.trace[0]).toMatchObject({ turnIndex: 0, markerId: marker.id });
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    answer(before, [deltaFor("judah-strength-front")]);
    expect(before.turns).toEqual([]);
    expect(before.profile.judah).toBe(0);
    expect(before.currentQuestion).toBe(OPENING_QUESTION);
  });

  it("completes the Session once the Turn cap is reached", () => {
    let state = initialState();
    for (let i = 0; i < INTERVIEW_TURN_CAP; i++) {
      expect(state.status).toBe("in_progress");
      state = answer(state, [deltaFor("levi-strength-guard", 1)]);
    }
    expect(state.status).toBe("complete");
    expect(state.currentQuestion).toBeNull();
    expect(nextTurn(state)).toEqual({ kind: "result" });
    // Strength accumulated across every Turn.
    const marker = getMarkerById("levi-strength-guard")!;
    expect(state.profile.levi).toBeCloseTo(marker.weight * INTERVIEW_TURN_CAP);
  });

  it("is a no-op once the Session is already complete", () => {
    let state = initialState();
    for (let i = 0; i < INTERVIEW_TURN_CAP; i++) state = answer(state, []);
    const again = answer(state, [deltaFor("judah-strength-front")]);
    expect(again).toBe(state);
    expect(again.turns).toHaveLength(INTERVIEW_TURN_CAP);
  });
});

describe("deriveInterviewResult", () => {
  it("returns the full 12-tribe ranking for a completed Session", () => {
    let state = initialState();
    // Score judah hardest, levi second.
    state = answer(state, [deltaFor("judah-strength-front", 1), deltaFor("judah-oil-responsibility", 1)]);
    state = answer(state, [deltaFor("judah-strength-weight", 1)]);
    state = answer(state, [deltaFor("levi-strength-guard", 1)]);
    const result = deriveInterviewResult(state);
    expect(result.ranking).toHaveLength(tribes.length);
    expect(result.ranking[0].slug).toBe("judah");
    expect(result.ranking[0].share).toBeGreaterThan(result.ranking[1].share);
  });

  it("refuses to produce a result before completion", () => {
    expect(() => deriveInterviewResult(initialState())).toThrow();
  });
});
