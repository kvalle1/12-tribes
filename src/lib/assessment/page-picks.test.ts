import { describe, it, expect } from "vitest";
import { togglePick, isLocked } from "./page-picks";

describe("page picks", () => {
  it("selects a word", () => {
    expect(togglePick([], "Bold")).toEqual(["Bold"]);
  });

  it("deselects an already-picked word", () => {
    expect(togglePick(["Bold", "Just"], "Bold")).toEqual(["Just"]);
  });

  it("ignores a fourth pick once three are chosen", () => {
    const three = ["Bold", "Just", "Wise"];
    expect(togglePick(three, "Tough")).toEqual(three);
  });

  it("locks unpicked words once three are chosen, but never picked ones", () => {
    const three = ["Bold", "Just", "Wise"];
    expect(isLocked(three, "Tough")).toBe(true);
    expect(isLocked(three, "Bold")).toBe(false);
    expect(isLocked(["Bold"], "Tough")).toBe(false);
  });
});
