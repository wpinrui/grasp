// @vitest-environment node
import { describe, expect, it } from "vitest";
import { onlyPick, togglePick } from "./picking";

describe("what a click picks", () => {
  it("takes the one thing it landed on", () => {
    expect(onlyPick("c")).toEqual(["c"]);
  });

  it("adds to what is held when the click asks to", () => {
    expect(togglePick(["a"], "b")).toEqual(["a", "b"]);
  });

  it("takes back out what was already there", () => {
    expect(togglePick(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("leaves what it was handed alone", () => {
    const held = ["a"];
    togglePick(held, "b");
    expect(held).toEqual(["a"]);
  });
});
