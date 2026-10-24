import { describe, expect, it } from "vitest";
import { shouldShowResultsEntry } from "./home-entry";

/**
 * The home page surfaces a "View your results" entry only to a signed-in
 * Account that already has a saved result (issue #18). This truth table pins
 * that gate: the entry is hidden for signed-out visitors and for signed-in
 * users who haven't taken the assessment yet.
 */
describe("shouldShowResultsEntry", () => {
  it("shows the entry for a signed-in user with a saved result", () => {
    expect(shouldShowResultsEntry({ signedIn: true, hasResult: true })).toBe(
      true,
    );
  });

  it("hides the entry for a signed-in user without a result", () => {
    expect(shouldShowResultsEntry({ signedIn: true, hasResult: false })).toBe(
      false,
    );
  });

  it("hides the entry for a signed-out visitor, even if a result somehow exists", () => {
    expect(shouldShowResultsEntry({ signedIn: false, hasResult: true })).toBe(
      false,
    );
  });

  it("hides the entry for a signed-out visitor with no result", () => {
    expect(shouldShowResultsEntry({ signedIn: false, hasResult: false })).toBe(
      false,
    );
  });
});
