import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  TOTAL_TURNS,
  createInitialState,
  initialProfile,
  isComplete,
  nextTurn,
  recordAnswer,
} from "./skeleton";

describe("initialProfile", () => {
  it("has an entry for every tribe, all zeroed", () => {
    const profile = initialProfile();
    expect(Object.keys(profile)).toHaveLength(tribes.length);
    for (const tribe of tribes) {
      expect(profile[tribe.slug]).toBe(0);
    }
  });
});

describe("createInitialState", () => {
  it("starts in progress with no Turns recorded", () => {
    const state = createInitialState();
    expect(state.status).toBe("in_progress");
    expect(state.turns).toEqual([]);
    expect(state.turnCount).toBe(0);
    expect(isComplete(state)).toBe(false);
  });
});

describe("nextTurn", () => {
  it("returns the first question for a fresh Session", () => {
    const turn = nextTurn(createInitialState());
    expect(turn.kind).toBe("question");
    if (turn.kind === "question") {
      expect(turn.index).toBe(0);
      expect(turn.prompt.length).toBeGreaterThan(0);
    }
  });

  it("returns stop once every Turn has been answered", () => {
    let state = createInitialState();
    for (let i = 0; i < TOTAL_TURNS; i++) {
      state = recordAnswer(state, `answer ${i}`);
    }
    expect(nextTurn(state)).toEqual({ kind: "stop" });
  });

  it("resumes at the right Turn from a reconstructed (persisted) state", () => {
    // Simulate loading a partially-completed Session back from Postgres: the
    // next Turn is derived purely from the state, not from in-memory progress.
    const reconstructed = { ...createInitialState(), turnCount: 0 };
    const turn = nextTurn(reconstructed);
    expect(turn).toEqual(nextTurn(createInitialState()));
  });
});

describe("recordAnswer", () => {
  it("appends the Turn, increments the count, and does not mutate the input", () => {
    const before = createInitialState();
    const after = recordAnswer(before, "  my honest answer  ");

    expect(before.turnCount).toBe(0);
    expect(before.turns).toEqual([]);

    expect(after.turnCount).toBe(1);
    expect(after.turns).toHaveLength(1);
    expect(after.turns[0]).toMatchObject({ index: 0, answer: "  my honest answer  " });
    expect(after.turns[0].question.length).toBeGreaterThan(0);
  });

  it("marks the Session complete after the final Turn", () => {
    let state = createInitialState();
    for (let i = 0; i < TOTAL_TURNS; i++) {
      expect(state.status).toBe("in_progress");
      state = recordAnswer(state, `answer ${i}`);
    }
    expect(state.status).toBe("complete");
    expect(isComplete(state)).toBe(true);
  });

  it("refuses to record past completion (stale/replayed submission)", () => {
    let state = createInitialState();
    for (let i = 0; i < TOTAL_TURNS; i++) {
      state = recordAnswer(state, `answer ${i}`);
    }
    expect(() => recordAnswer(state, "extra")).toThrow();
  });
});
