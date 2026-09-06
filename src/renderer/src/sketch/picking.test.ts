// @vitest-environment node
import { describe, expect, it } from "vitest";
import { labelClickPick, togglePick } from "./picking";

describe("what a click picks", () => {
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

describe("what a label click leaves held", () => {
  it("clears the group where the click landed on nothing", () => {
    expect(labelClickPick(["a", "b"], null)).toEqual([]);
    expect(labelClickPick(["a", "b"], null, true)).toEqual([]);
  });

  it("takes the one it landed on, on its own", () => {
    expect(labelClickPick(["a", "b"], "c")).toEqual(["c"]);
    expect(labelClickPick(["a", "b"], "a")).toEqual(["a"]);
  });

  it("toggles within the group where the click asks to add", () => {
    expect(labelClickPick(["a"], "b", true)).toEqual(["a", "b"]);
    expect(labelClickPick(["a", "b"], "a", true)).toEqual(["b"]);
  });
});
