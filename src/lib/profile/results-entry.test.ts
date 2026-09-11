import { describe, it, expect } from "vitest";
import { showResultsEntry } from "./results-entry";

/**
 * Truth table for the home-page "View your results" entry (issue #18). It is
 * shown only to a signed-in user who has a saved result; hidden for signed-out
 * visitors and for signed-in users who haven't taken the assessment yet.
 */
describe("showResultsEntry", () => {
  it("shows the entry for a signed-in user with a saved result", () => {
    expect(showResultsEntry({ signedIn: true, hasResult: true })).toBe(true);
  });

  it("hides the entry for a signed-in user with no saved result", () => {
    expect(showResultsEntry({ signedIn: true, hasResult: false })).toBe(false);
  });

  it("hides the entry for a signed-out visitor, even if a result somehow exists", () => {
    expect(showResultsEntry({ signedIn: false, hasResult: true })).toBe(false);
  });

  it("hides the entry for a signed-out visitor with no result", () => {
    expect(showResultsEntry({ signedIn: false, hasResult: false })).toBe(false);
  });
});
