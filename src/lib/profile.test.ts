import { describe, it, expect } from "vitest";
import { shouldShowResultsEntry } from "./profile";

/**
 * The "View your results" home entry is personalized: it appears only for a
 * signed-in user who has a saved result, and is hidden for everyone else
 * (issue #18 acceptance criteria 1–2). This pins that rule down as a pure
 * predicate so the home page's conditional rendering can't drift from it.
 */
describe("shouldShowResultsEntry", () => {
  it("shows the entry for a signed-in user with a saved result", () => {
    expect(shouldShowResultsEntry(true, true)).toBe(true);
  });

  it("hides the entry for a signed-in user with no result yet", () => {
    expect(shouldShowResultsEntry(true, false)).toBe(false);
  });

  it("hides the entry for a signed-out visitor", () => {
    expect(shouldShowResultsEntry(false, false)).toBe(false);
  });

  it("hides the entry for a signed-out visitor even if a result is present", () => {
    // Defensive: a result can never belong to a signed-out visitor, but the
    // sign-in gate must dominate regardless of the result flag.
    expect(shouldShowResultsEntry(false, true)).toBe(false);
  });
});
