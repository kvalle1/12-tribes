import { describe, it, expect } from "vitest";
import { isSelfSubmission, observerCookieName } from "./anti-abuse";

describe("isSelfSubmission", () => {
  it("is true when the signed-in submitter is the Subject", () => {
    expect(isSelfSubmission("user-1", "user-1")).toBe(true);
  });

  it("is false when a different signed-in user submits", () => {
    expect(isSelfSubmission("observer-9", "user-1")).toBe(false);
  });

  it("is false for an anonymous (signed-out) submitter", () => {
    expect(isSelfSubmission(null, "user-1")).toBe(false);
    expect(isSelfSubmission(undefined, "user-1")).toBe(false);
  });

  it("does not treat an empty submitter id as a match", () => {
    expect(isSelfSubmission("", "")).toBe(false);
  });
});

describe("observerCookieName", () => {
  it("is stable for the same token", () => {
    expect(observerCookieName("tok-abc")).toBe(observerCookieName("tok-abc"));
  });

  it("differs for different tokens", () => {
    expect(observerCookieName("tok-abc")).not.toBe(observerCookieName("tok-xyz"));
  });

  it("never embeds the raw token (no link leak via cookie name)", () => {
    const token = "a2f6c9e1-1111-2222-3333-444455556666";
    expect(observerCookieName(token)).not.toContain(token);
  });

  it("is a valid cookie name — no separators, spaces, or control chars", () => {
    const name = observerCookieName("some/weird token;with=seps");
    expect(name).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
