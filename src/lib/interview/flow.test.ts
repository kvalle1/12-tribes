import { describe, expect, it } from "vitest";
import { tribes } from "@/lib/tribes";
import {
  FIRST_QUESTION,
  currentTurn,
  emptyProfile,
  recordAnswer,
  startSession,
  toClientView,
} from "./flow";

describe("startSession", () => {
  it("opens an in-progress Session whose first Turn is the hardcoded question", () => {
    const session = startSession("s1");

    expect(session.id).toBe("s1");
    expect(session.status).toBe("in_progress");
    expect(session.turnCount).toBe(0);
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]).toEqual({
      index: 0,
      question: FIRST_QUESTION,
      answer: null,
    });
  });

  it("starts with a zeroed Strength Profile covering every tribe", () => {
    const session = startSession("s1");
    const slugs = Object.keys(session.profile).sort();

    expect(slugs).toEqual(tribes.map((t) => t.slug).sort());
    expect(Object.values(session.profile).every((v) => v === 0)).toBe(true);
  });

  it("links to an Account when a userId is supplied, and is unlinked otherwise", () => {
    expect(startSession("s1").userId).toBeNull();
    expect(startSession("s2", "user-123").userId).toBe("user-123");
  });
});

describe("currentTurn", () => {
  it("returns the pending (unanswered) Turn while in progress", () => {
    const session = startSession("s1");
    expect(currentTurn(session)?.index).toBe(0);
  });

  it("returns null once every Turn is answered", () => {
    const done = recordAnswer(startSession("s1"), "an answer");
    expect(currentTurn(done)).toBeNull();
  });
});

describe("recordAnswer", () => {
  it("stores the answer on the pending Turn and counts it", () => {
    const session = recordAnswer(startSession("s1"), "  because I lead  ");

    expect(session.turns[0].answer).toBe("because I lead");
    expect(session.turnCount).toBe(1);
  });

  it("completes the walking-skeleton flow after the single question", () => {
    const session = recordAnswer(startSession("s1"), "an answer");
    expect(session.status).toBe("complete");
  });

  it("does not mutate the input Session", () => {
    const session = startSession("s1");
    recordAnswer(session, "an answer");

    expect(session.status).toBe("in_progress");
    expect(session.turns[0].answer).toBeNull();
    expect(session.turnCount).toBe(0);
  });

  it("is a no-op when the Session is already complete", () => {
    const done = recordAnswer(startSession("s1"), "first");
    const again = recordAnswer(done, "second");

    expect(again.turnCount).toBe(1);
    expect(again.turns[0].answer).toBe("first");
    expect(again.status).toBe("complete");
  });
});

describe("toClientView", () => {
  it("exposes only the pending question — never scoring state or prior answers", () => {
    const view = toClientView(startSession("s1"));

    expect(view).toEqual({
      sessionId: "s1",
      status: "in_progress",
      currentTurn: { index: 0, question: FIRST_QUESTION },
      turnCount: 0,
    });
    // The profile and raw answers must not leak across the client boundary.
    expect(JSON.stringify(view)).not.toContain("profile");
    expect(JSON.stringify(view)).not.toContain("answer");
  });

  it("reports no current Turn once the Interview is complete", () => {
    const view = toClientView(recordAnswer(startSession("s1"), "an answer"));

    expect(view.status).toBe("complete");
    expect(view.currentTurn).toBeNull();
    expect(view.turnCount).toBe(1);
  });
});

describe("emptyProfile", () => {
  it("is a fresh object each call (no shared mutable state)", () => {
    expect(emptyProfile()).not.toBe(emptyProfile());
  });
});
