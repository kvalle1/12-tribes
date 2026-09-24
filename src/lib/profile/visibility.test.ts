import { describe, it, expect } from "vitest";
import { shouldShowResultsEntry } from "./visibility";

describe("shouldShowResultsEntry", () => {
  it("shows the entry for a signed-in user who has a saved result", () => {
    expect(shouldShowResultsEntry({ signedIn: true, hasResult: true })).toBe(
      true,
    );
  });

  it("hides the entry for a signed-out visitor, even if a result somehow exists", () => {
    expect(shouldShowResultsEntry({ signedIn: false, hasResult: true })).toBe(
      false,
    );
  });

  it("hides the entry for a signed-in user who has not taken the assessment", () => {
    expect(shouldShowResultsEntry({ signedIn: true, hasResult: false })).toBe(
      false,
    );
  });

  it("hides the entry for a signed-out visitor with no result", () => {
    expect(shouldShowResultsEntry({ signedIn: false, hasResult: false })).toBe(
      false,
    );
  });
});
