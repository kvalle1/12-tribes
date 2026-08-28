import { describe, it, expect } from "vitest";
import { shouldShowResultsEntry } from "./profile";

describe("shouldShowResultsEntry", () => {
  it("shows the entry only when signed in with a saved result", () => {
    expect(shouldShowResultsEntry({ signedIn: true, hasResult: true })).toBe(
      true,
    );
  });

  it("hides the entry for signed-out visitors, even if a result somehow exists", () => {
    expect(shouldShowResultsEntry({ signedIn: false, hasResult: true })).toBe(
      false,
    );
    expect(shouldShowResultsEntry({ signedIn: false, hasResult: false })).toBe(
      false,
    );
  });

  it("hides the entry for signed-in users who haven't taken the assessment", () => {
    expect(shouldShowResultsEntry({ signedIn: true, hasResult: false })).toBe(
      false,
    );
  });
});
