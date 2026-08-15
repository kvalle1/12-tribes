import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  CALIBRATION_OPENER,
  emptyProfile,
  initialState,
  MAX_QUESTIONS,
  nextTurn,
  recordScoredAnswer,
} from "./flow";
import { getMarkerById } from "./markers";
import type { InterviewState, MarkerDelta } from "./types";

const JUDAH_STRENGTH = "judah-strength-front";

function delta(markerId: string, value: number): MarkerDelta {
  const marker = getMarkerById(markerId)!;
  return {
    markerId: marker.id,
    tribeSlug: marker.tribeSlug,
    type: marker.type,
    delta: value,
    postureSignal: "aware",
  };
}

/** Drive the flow through `count` scored answers, each firing one strength delta. */
function advance(count: number): InterviewState {
  let state = initialState();
  for (let i = 0; i < count; i++) {
    state = recordScoredAnswer(state, `answer ${i}`, [delta(JUDAH_STRENGTH, 1)], `next question ${i}`);
  }
  return state;
}

describe("emptyProfile", () => {
  it("covers all 12 tribes, zeroed, keyed by slug", () => {
    const profile = emptyProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) expect(profile[tribe.slug]).toBe(0);
  });
});

describe("initialState / nextTurn", () => {
  it("starts in progress with no turns, no traces, and the fixed opener pending", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.traces).toEqual([]);
    expect(state.pendingQuestion).toBe(CALIBRATION_OPENER);
  });

  it("presents the fixed Calibration opener first", () => {
    expect(nextTurn(initialState())).toEqual({
      kind: "question",
      prompt: CALIBRATION_OPENER,
      questionNumber: 1,
      totalQuestions: MAX_QUESTIONS,
    });
  });
});

describe("recordScoredAnswer", () => {
  it("records the answer against the question that was pending", () => {
    const state = recordScoredAnswer(initialState(), "felt most alive leading a team", [], "and then?");
    expect(state.turns).toEqual([
      { question: CALIBRATION_OPENER, answer: "felt most alive leading a team" },
    ]);
  });

  it("applies the cited deltas to the Strength Profile and keeps their traces", () => {
    const state = recordScoredAnswer(initialState(), "an answer", [delta(JUDAH_STRENGTH, 1)], "next?");
    expect(state.profile.judah).toBe(1);
    expect(state.traces).toHaveLength(1);
    expect(state.traces[0]).toMatchObject({ turnIndex: 0, markerId: JUDAH_STRENGTH });
  });

  it("queues the agent-produced next question while under the cap", () => {
    const state = recordScoredAnswer(initialState(), "an answer", [], "the LLM's follow-up");
    expect(state.status).toBe("in_progress");
    expect(state.pendingQuestion).toBe("the LLM's follow-up");
    expect(nextTurn(state)).toMatchObject({ kind: "question", prompt: "the LLM's follow-up", questionNumber: 2 });
  });

  it("falls back to the opener when the agent returns a blank next question", () => {
    const state = recordScoredAnswer(initialState(), "an answer", [], "   ".trim());
    expect(state.pendingQuestion).toBe(CALIBRATION_OPENER);
    expect(nextTurn(state)).toMatchObject({ kind: "question", prompt: CALIBRATION_OPENER });
  });

  it("completes the Interview at the question cap and clears the pending question", () => {
    const state = advance(MAX_QUESTIONS);
    expect(state.status).toBe("complete");
    expect(state.pendingQuestion).toBeNull();
    expect(state.turns).toHaveLength(MAX_QUESTIONS);
    expect(nextTurn(state)).toEqual({ kind: "result" });
  });

  it("accumulates strength across turns", () => {
    const state = advance(MAX_QUESTIONS);
    expect(state.profile.judah).toBe(MAX_QUESTIONS); // 1 per turn
  });

  it("is a no-op once the Interview is already complete", () => {
    const complete = advance(MAX_QUESTIONS);
    const again = recordScoredAnswer(complete, "late answer", [delta(JUDAH_STRENGTH, 1)], "ignored");
    expect(again).toBe(complete);
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    recordScoredAnswer(before, "an answer", [delta(JUDAH_STRENGTH, 1)], "next?");
    expect(before.turns).toEqual([]);
    expect(before.profile.judah).toBe(0);
    expect(before.pendingQuestion).toBe(CALIBRATION_OPENER);
  });
});
