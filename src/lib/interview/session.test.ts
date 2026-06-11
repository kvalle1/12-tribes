import { describe, it, expect } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  FIRST_QUESTION,
  createInitialSession,
  currentTurn,
  emptyProfile,
  isComplete,
  recordAnswer,
} from "./session";

describe("emptyProfile", () => {
  it("has a zeroed entry for every one of the 12 tribes, keyed by slug", () => {
    const profile = emptyProfile();
    const slugs = tribes.map((t) => t.slug).sort();
    expect(Object.keys(profile).sort()).toEqual(slugs);
    expect(Object.values(profile).every((v) => v === 0)).toBe(true);
  });
});

describe("createInitialSession", () => {
  it("starts in progress with no answered turns", () => {
    const session = createInitialSession();
    expect(session.status).toBe("in_progress");
    expect(session.turnCount).toBe(0);
    expect(isComplete(session)).toBe(false);
  });

  it("seeds a single open turn carrying the hardcoded first question", () => {
    const session = createInitialSession();
    expect(session.turns).toHaveLength(1);
    const [turn] = session.turns;
    expect(turn.kind).toBe("question");
    expect(turn.prompt).toBe(FIRST_QUESTION);
    expect(turn.answer).toBeNull();
    expect(turn.answeredAt).toBeNull();
  });

  it("seeds zeroed placeholder profile and posture for all 12 tribes", () => {
    const session = createInitialSession();
    expect(session.profile).toEqual(emptyProfile());
    expect(session.posture).toEqual(emptyProfile());
  });
});

describe("currentTurn", () => {
  it("returns the unanswered turn while the interview is open", () => {
    const session = createInitialSession();
    expect(currentTurn(session)?.prompt).toBe(FIRST_QUESTION);
  });

  it("returns null once every turn has an answer", () => {
    const session = recordAnswer(createInitialSession(), "a real answer");
    expect(currentTurn(session)).toBeNull();
  });
});

describe("recordAnswer", () => {
  it("attaches the trimmed answer and a timestamp to the open turn", () => {
    const at = new Date("2026-06-11T12:00:00.000Z");
    const session = recordAnswer(createInitialSession(), "  I felt alive leading  ", at);
    const [turn] = session.turns;
    expect(turn.answer).toBe("I felt alive leading");
    expect(turn.answeredAt).toBe(at.toISOString());
    expect(session.turnCount).toBe(1);
  });

  it("completes the (single-turn) skeleton interview once the question is answered", () => {
    const session = recordAnswer(createInitialSession(), "my answer");
    expect(session.status).toBe("complete");
    expect(isComplete(session)).toBe(true);
  });

  it("does not mutate the input session (pure transition)", () => {
    const before = createInitialSession();
    const snapshot = JSON.parse(JSON.stringify(before));
    recordAnswer(before, "my answer");
    expect(before).toEqual(snapshot);
  });

  it("rejects an empty or whitespace-only answer", () => {
    expect(() => recordAnswer(createInitialSession(), "   ")).toThrow();
    expect(() => recordAnswer(createInitialSession(), "")).toThrow();
  });

  it("rejects answering when there is no open turn", () => {
    const complete = recordAnswer(createInitialSession(), "my answer");
    expect(() => recordAnswer(complete, "again")).toThrow();
  });
});
