import { describe, it, expect } from "vitest";
import { shouldShowResultsEntry } from "./profile";

describe("shouldShowResultsEntry", () => {
  it("is hidden for signed-out visitors, whether or not a result somehow exists", () => {
    expect(shouldShowResultsEntry({ userId: null, hasResult: false })).toBe(false);
    expect(shouldShowResultsEntry({ userId: undefined, hasResult: false })).toBe(
      false,
    );
    expect(shouldShowResultsEntry({ userId: null, hasResult: true })).toBe(false);
    expect(shouldShowResultsEntry({ userId: "", hasResult: true })).toBe(false);
  });

  it("is hidden for a signed-in user who has not taken the assessment", () => {
    expect(shouldShowResultsEntry({ userId: "user_1", hasResult: false })).toBe(
      false,
    );
  });

  it("is shown only for a signed-in user with a saved result", () => {
    expect(shouldShowResultsEntry({ userId: "user_1", hasResult: true })).toBe(
      true,
    );
  });
});
