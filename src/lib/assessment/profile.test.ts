import { describe, expect, it } from "vitest";
import { canViewSavedResult } from "./profile";

/**
 * The visibility rule behind the home "View your results" entry and the
 * profile page gate (issue #18): a saved result is viewable only when the
 * visitor is signed in AND actually has a saved current result (ADR-0004).
 */
describe("canViewSavedResult", () => {
  const result = { primarySlug: "judah" };

  it("is true for a signed-in user with a saved result", () => {
    expect(canViewSavedResult("user-1", result)).toBe(true);
  });

  it("is false for a signed-out visitor, even if a result object is passed", () => {
    expect(canViewSavedResult(null, result)).toBe(false);
    expect(canViewSavedResult(undefined, result)).toBe(false);
    expect(canViewSavedResult("", result)).toBe(false);
  });

  it("is false for a signed-in user who has not taken the assessment", () => {
    expect(canViewSavedResult("user-1", null)).toBe(false);
    expect(canViewSavedResult("user-1", undefined)).toBe(false);
  });

  it("is false when neither signed in nor holding a result", () => {
    expect(canViewSavedResult(null, null)).toBe(false);
  });
});
