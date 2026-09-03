// @vitest-environment node
import { describe, expect, it } from "vitest";
import { togglePick } from "./picking";

describe("what a click picks", () => {
  it("takes the one thing it landed on", () => {
    expect(togglePick(["a", "b"], "c", false)).toEqual(["c"]);
  });

  it("takes it on its own even when it was already held", () => {
    expect(togglePick(["a", "b"], "a", false)).toEqual(["a"]);
  });

  it("adds to what is held when the click asks to", () => {
    expect(togglePick(["a"], "b", true)).toEqual(["a", "b"]);
  });

  it("takes back out what was already there", () => {
    expect(togglePick(["a", "b", "c"], "b", true)).toEqual(["a", "c"]);
  });

  it("leaves what it was handed alone", () => {
    const held = ["a"];
    togglePick(held, "b", true);
    expect(held).toEqual(["a"]);
  });
});
