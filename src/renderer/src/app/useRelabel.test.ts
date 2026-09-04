// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canStartAt, nameAt } from "./useRelabel";

/**
 * A relabel run hands out the letters in order from the one it was started at,
 * so what it says next depends on nothing but that letter and how many vertices
 * have been clicked. That is what lets an undo give a letter back: the run's
 * place steps back and the same name comes round again.
 */
describe("the letters a relabel run hands out", () => {
  it("walks the alphabet from the letter it started at", () => {
    expect([0, 1, 2].map((step) => nameAt("A", step))).toEqual(["A", "B", "C"]);
    expect([0, 1, 2].map((step) => nameAt("P", step))).toEqual(["P", "Q", "R"]);
  });

  it("wraps, so the name after Z is A again", () => {
    expect(nameAt("Z", 1)).toBe("A");
    expect(nameAt("Y", 3)).toBe("B");
  });

  it("walks the small letters from a small start", () => {
    expect([0, 1].map((step) => nameAt("x", step))).toEqual(["x", "y"]);
    expect(nameAt("z", 1)).toBe("a");
  });

  it("starts at one letter and nothing else", () => {
    expect(canStartAt("A")).toBe(true);
    expect(canStartAt("q")).toBe(true);
    expect(canStartAt("")).toBe(false);
    expect(canStartAt("AB")).toBe(false);
    expect(canStartAt("1")).toBe(false);
  });
});
