import { describe, it, expect } from "vitest";
import {
  observerResponseCookieName,
  observerSubmissionRejection,
} from "./submission-guard";

describe("observerSubmissionRejection", () => {
  const subjectId = "subject-abc";

  it("accepts an anonymous first-time read", () => {
    expect(
      observerSubmissionRejection({
        viewerUserId: null,
        subjectId,
        alreadyRespondedFromBrowser: false,
      }),
    ).toBeNull();
  });

  it("accepts a signed-in observer who is not the Subject", () => {
    expect(
      observerSubmissionRejection({
        viewerUserId: "someone-else",
        subjectId,
        alreadyRespondedFromBrowser: false,
      }),
    ).toBeNull();
  });

  it("rejects the Subject submitting against their own link as 'self'", () => {
    expect(
      observerSubmissionRejection({
        viewerUserId: subjectId,
        subjectId,
        alreadyRespondedFromBrowser: false,
      }),
    ).toBe("self");
  });

  it("rejects 'self' even when the browser hasn't responded yet (self takes precedence)", () => {
    expect(
      observerSubmissionRejection({
        viewerUserId: subjectId,
        subjectId,
        alreadyRespondedFromBrowser: true,
      }),
    ).toBe("self");
  });

  it("rejects a browser that already responded as 'duplicate'", () => {
    expect(
      observerSubmissionRejection({
        viewerUserId: null,
        subjectId,
        alreadyRespondedFromBrowser: true,
      }),
    ).toBe("duplicate");
  });

  it("rejects a repeat read from a signed-in non-Subject as 'duplicate'", () => {
    expect(
      observerSubmissionRejection({
        viewerUserId: "someone-else",
        subjectId,
        alreadyRespondedFromBrowser: true,
      }),
    ).toBe("duplicate");
  });

  it("does not treat a falsy/empty viewer id as the Subject", () => {
    expect(
      observerSubmissionRejection({
        viewerUserId: "",
        subjectId: "",
        alreadyRespondedFromBrowser: false,
      }),
    ).toBeNull();
  });
});

describe("observerResponseCookieName", () => {
  it("is stable for a given token", () => {
    expect(observerResponseCookieName("tok-1")).toBe(
      observerResponseCookieName("tok-1"),
    );
  });

  it("differs between tokens", () => {
    expect(observerResponseCookieName("tok-1")).not.toBe(
      observerResponseCookieName("tok-2"),
    );
  });

  it("produces a cookie-name-safe string (no spaces or separators)", () => {
    const name = observerResponseCookieName("abc-123-def");
    expect(name).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
