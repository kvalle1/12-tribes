import { describe, it, expect } from "vitest";
import { anonymousOrder } from "./anonymize";

const rows = (...ids: string[]) => ids.map((id) => ({ id }));

describe("anonymousOrder", () => {
  it("is deterministic for a given subject and set of rows", () => {
    const input = rows("a", "b", "c", "d");
    const first = anonymousOrder("subject-1", input);
    const second = anonymousOrder("subject-1", input);
    expect(first).toEqual(second);
  });

  it("does not depend on the input (arrival) order — no temporal signal leaks", () => {
    const arrivalOrder = rows("a", "b", "c", "d", "e");
    const reversed = [...arrivalOrder].reverse();
    expect(anonymousOrder("subject-1", arrivalOrder)).toEqual(
      anonymousOrder("subject-1", reversed),
    );
  });

  it("preserves every row exactly once", () => {
    const input = rows("a", "b", "c", "d", "e");
    const ordered = anonymousOrder("subject-1", input);
    expect(ordered).toHaveLength(input.length);
    expect(new Set(ordered.map((r) => r.id))).toEqual(
      new Set(input.map((r) => r.id)),
    );
  });

  it("orders differently for different subjects (label is not a shared identity)", () => {
    // With enough rows the permutation is exceedingly unlikely to coincide, so a
    // Subject can't line their Observer 1 up with another Subject's.
    const input = rows("a", "b", "c", "d", "e", "f", "g", "h");
    const forOne = anonymousOrder("subject-1", input).map((r) => r.id);
    const forTwo = anonymousOrder("subject-2", input).map((r) => r.id);
    expect(forOne).not.toEqual(forTwo);
  });

  it("does not mutate the input array", () => {
    const input = rows("c", "a", "b");
    const snapshot = input.map((r) => r.id);
    anonymousOrder("subject-1", input);
    expect(input.map((r) => r.id)).toEqual(snapshot);
  });

  it("handles empty and single-row inputs", () => {
    expect(anonymousOrder("s", [])).toEqual([]);
    expect(anonymousOrder("s", rows("only"))).toEqual(rows("only"));
  });
});
