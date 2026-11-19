import { describe, expect, it } from "vitest";
import { buildAccountOverview, OBSERVERS_NEEDED } from "./overview";

const base = {
  name: null,
  email: "landan@example.com",
  assessment: null,
  observerCount: 0,
  interview: null,
};

describe("buildAccountOverview", () => {
  it("points a new participant at the Self Assessment as the next step", () => {
    const o = buildAccountOverview(base);
    expect(o.self.status).toBe("not-started");
    expect(o.nextStep).toEqual({
      href: "/assessment",
      label: "Take the Self Assessment",
    });
    expect(o.strengthTribes).toEqual([]);
  });

  it("surfaces primary and secondary tribes as the strengths to explore", () => {
    const o = buildAccountOverview({
      ...base,
      assessment: {
        primarySlug: "judah",
        secondarySlug: "levi",
        updatedAt: new Date("2026-11-01"),
      },
    });
    expect(o.self.status).toBe("complete");
    expect(o.strengthTribes.map((t) => t.slug)).toEqual(["judah", "levi"]);
  });

  const done = {
    primarySlug: "judah",
    secondarySlug: null,
    updatedAt: new Date("2026-11-01"),
  };

  it("locks the 360 until the Self Assessment exists", () => {
    const o = buildAccountOverview(base);
    expect(o.observers).toMatchObject({ status: "locked", count: 0 });
  });

  it("tracks observer responses toward the threshold, then goes ready", () => {
    const some = buildAccountOverview({ ...base, assessment: done, observerCount: 1 });
    expect(some.observers).toEqual({
      status: "collecting",
      count: 1,
      needed: OBSERVERS_NEEDED,
      remaining: OBSERVERS_NEEDED - 1,
    });
    const ready = buildAccountOverview({
      ...base,
      assessment: done,
      observerCount: OBSERVERS_NEEDED,
    });
    expect(ready.observers).toMatchObject({ status: "ready", remaining: 0 });
  });

  it("reports interview state", () => {
    expect(buildAccountOverview(base).interview.status).toBe("not-started");
    expect(
      buildAccountOverview({ ...base, interview: { status: "in_progress", turnCount: 2 } })
        .interview,
    ).toEqual({ status: "in-progress", turnCount: 2 });
    expect(
      buildAccountOverview({ ...base, interview: { status: "complete", turnCount: 5 } })
        .interview.status,
    ).toBe("complete");
  });

  it("recommends the next step in order: self, observers, interview, then deep-dive", () => {
    const next = (o: Partial<Parameters<typeof buildAccountOverview>[0]>) =>
      buildAccountOverview({ ...base, ...o }).nextStep.href;
    expect(next({})).toBe("/assessment");
    expect(next({ assessment: done })).toBe("/assessment/result#share");
    expect(next({ assessment: done, observerCount: 3 })).toBe("/interview");
    expect(
      next({
        assessment: done,
        observerCount: 3,
        interview: { status: "in_progress", turnCount: 1 },
      }),
    ).toBe("/interview");
    expect(
      next({
        assessment: done,
        observerCount: 3,
        interview: { status: "complete", turnCount: 5 },
      }),
    ).toBe("/tribes/judah");
  });

  it("counts completed instruments out of three", () => {
    expect(buildAccountOverview(base).completedCount).toBe(0);
    expect(
      buildAccountOverview({
        ...base,
        assessment: done,
        observerCount: 3,
        interview: { status: "complete", turnCount: 5 },
      }).completedCount,
    ).toBe(3);
  });

  it("greets by name, falling back to the email's local part", () => {
    expect(buildAccountOverview({ ...base, name: " Ada " }).displayName).toBe("Ada");
    expect(buildAccountOverview(base).displayName).toBe("landan");
    expect(
      buildAccountOverview({ ...base, email: null }).displayName,
    ).toBe("friend");
  });
});
