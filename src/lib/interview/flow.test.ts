import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import { MAX_TURNS, MIN_TURNS } from "./confidence";
import {
  applyTurn,
  emptyProfile,
  FALLBACK_QUESTIONS,
  initialState,
  nextTurn,
  OPENING_QUESTION,
  type ScoredAnswer,
} from "./flow";
import type { InterviewState, MarkerDelta } from "./types";

const delta = (tribeSlug: string, value: number): MarkerDelta => ({
  markerId: `${tribeSlug}-m`,
  tribeSlug,
  type: "strength",
  delta: value,
  postureSignal: "neutral",
});

/** A Turn that clearly favours Judah, with Levi a close Contender and Dan well behind. */
const decisive: ScoredAnswer = {
  deltas: [delta("judah", 4), delta("levi", 3.2), delta("dan", 1)],
  nextQuestion: "Next?",
};

/** A Turn that leaves Judah and Levi inseparable. */
const tied: ScoredAnswer = {
  deltas: [delta("judah", 2), delta("levi", 2)],
  nextQuestion: "Next?",
};

function run(turns: number, scored: ScoredAnswer): InterviewState {
  let state = initialState();
  for (let i = 0; i < turns; i++) state = applyTurn(state, `answer ${i}`, scored);
  return state;
}

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
  it("starts in progress with no turns, asking the opening question", () => {
    const state = initialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(nextTurn(state)).toEqual({
      kind: "question",
      prompt: OPENING_QUESTION,
      questionNumber: 1,
    });
  });
});

describe("applyTurn", () => {
  it("records the answer against the question that was pending", () => {
    const state = applyTurn(initialState(), "I was teaching a friend to climb.", decisive);
    expect(state.turns).toEqual([
      { question: OPENING_QUESTION, answer: "I was teaching a friend to climb." },
    ]);
  });

  it("applies the scored deltas and traces them to the Turn", () => {
    const state = applyTurn(initialState(), "a", decisive);
    expect(state.profile.judah).toBe(4);
    expect(state.trace.map((t) => t.turnIndex)).toEqual([0, 0, 0]);
  });

  it("queues the agent's proposed next question", () => {
    const state = applyTurn(initialState(), "a", { ...decisive, nextQuestion: "What drains you?" });
    expect(nextTurn(state)).toEqual({ kind: "question", prompt: "What drains you?", questionNumber: 2 });
  });

  it("falls back to an authored question when the agent proposes none", () => {
    const state = applyTurn(initialState(), "a", { ...decisive, nextQuestion: null });
    expect(state.pendingQuestion).toBe(FALLBACK_QUESTIONS[0]);
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    applyTurn(before, "an answer", decisive);
    expect(before.turns).toEqual([]);
    expect(before.profile.judah).toBe(0);
  });

  it("keeps asking until the minimum floor, then stops with a Primary and Contenders", () => {
    const early = run(MIN_TURNS - 1, decisive);
    expect(early.status).toBe("in_progress");

    const done = run(MIN_TURNS, decisive);
    expect(done.status).toBe("complete");
    expect(nextTurn(done)).toEqual({ kind: "result" });
    expect(done.result?.primary).toEqual(["judah"]);
    expect(done.result?.contenders).toEqual(["judah", "levi"]);
  });

  it("runs to the cap and reports Co-Primaries when the top tribes never separate", () => {
    expect(run(MAX_TURNS - 1, tied).status).toBe("in_progress");
    const done = run(MAX_TURNS, tied);
    expect(done.status).toBe("complete");
    expect(done.turns).toHaveLength(MAX_TURNS);
    expect(done.result?.coPrimary).toBe(true);
    expect(done.result?.primary).toEqual(["judah", "levi"]);
  });

  it("is a no-op once the session is already complete", () => {
    const complete = run(MIN_TURNS, decisive);
    expect(applyTurn(complete, "more", decisive)).toBe(complete);
  });
});
