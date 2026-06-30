import { describe, it, expect } from "vitest";
import { observerDisplayName } from "./display-name";

describe("observerDisplayName", () => {
  it("prefers the Subject's name when present", () => {
    expect(observerDisplayName("Deborah", "deb@example.com")).toBe("Deborah");
  });

  it("trims surrounding whitespace from the name", () => {
    expect(observerDisplayName("  Deborah  ", null)).toBe("Deborah");
  });

  it("falls back to the email's local part when the name is missing", () => {
    expect(observerDisplayName(null, "barak@example.com")).toBe("barak");
  });

  it("falls back to the email's local part when the name is blank", () => {
    expect(observerDisplayName("   ", "barak@example.com")).toBe("barak");
  });

  it("falls back to a neutral phrase when neither is available", () => {
    expect(observerDisplayName(null, null)).toBe("this person");
    expect(observerDisplayName(undefined, undefined)).toBe("this person");
  });

  it("does not leak an empty local part from a malformed email", () => {
    expect(observerDisplayName(null, "@example.com")).toBe("this person");
  });
});
