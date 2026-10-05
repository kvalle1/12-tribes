import { describe, expect, it } from "vitest";
import { shouldShowResultsEntry } from "./results-entry";

/**
 * The "View your results" home-page entry (issue #18) is shown only to a
 * signed-in user who already has a saved result. Everyone else — signed-out
 * visitors, users still resolving their session, and signed-in users who
 * haven't taken the assessment — must not see it (acceptance criteria 1 & 2).
 */
describe("shouldShowResultsEntry", () => {
  it("shows the entry for an authenticated user with a saved result", () => {
    expect(shouldShowResultsEntry("authenticated", true)).toBe(true);
  });

  it("hides the entry for an authenticated user with no saved result", () => {
    expect(shouldShowResultsEntry("authenticated", false)).toBe(false);
  });

  it("hides the entry for a signed-out visitor", () => {
    expect(shouldShowResultsEntry("unauthenticated", true)).toBe(false);
    expect(shouldShowResultsEntry("unauthenticated", false)).toBe(false);
  });

  it("hides the entry while the session is still loading", () => {
    expect(shouldShowResultsEntry("loading", true)).toBe(false);
    expect(shouldShowResultsEntry("loading", false)).toBe(false);
  });
});
