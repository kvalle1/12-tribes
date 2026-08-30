import { describe, expect, it } from "vitest";
import { shouldShowResultsLink } from "./profile";

/**
 * The home page surfaces a "View your results" entry only when the visitor is
 * signed in AND has a saved result (issue #18). This pins the gating rule so it
 * can't silently flip.
 */
describe("shouldShowResultsLink", () => {
  it("shows the entry for a signed-in user with a saved result", () => {
    expect(shouldShowResultsLink({ signedIn: true, hasResult: true })).toBe(
      true,
    );
  });

  it("hides the entry for a signed-out visitor", () => {
    expect(shouldShowResultsLink({ signedIn: false, hasResult: false })).toBe(
      false,
    );
  });

  it("hides the entry for a signed-out visitor even if a result somehow exists", () => {
    expect(shouldShowResultsLink({ signedIn: false, hasResult: true })).toBe(
      false,
    );
  });

  it("hides the entry for a signed-in user who has not taken the assessment", () => {
    expect(shouldShowResultsLink({ signedIn: true, hasResult: false })).toBe(
      false,
    );
  });
});
