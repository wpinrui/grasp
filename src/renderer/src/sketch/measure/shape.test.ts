// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createLine, lineThrough, type SketchObject } from "../model";
import { cornerOf } from "./shape";

/**
 * The corner two straight objects share, which is what an angle is asked about
 * whenever it is named by its sides rather than by its three points. The order
 * of what comes back is load-bearing: the corner is in the middle, and each arm
 * is on the side of the object it came from.
 */

const EAST: SketchObject = { ...lineThrough("segment", ["A", "B"]), id: "east" };
const SOUTH: SketchObject = { ...lineThrough("segment", ["A", "C"]), id: "south" };
const FAR: SketchObject = { ...lineThrough("segment", ["B", "D"]), id: "far" };

describe("the corner two straight objects share", () => {
  it("puts the corner between the far end of each, in the order they were asked", () => {
    expect(cornerOf(EAST, SOUTH)).toEqual(["B", "A", "C"]);
    expect(cornerOf(SOUTH, EAST)).toEqual(["C", "A", "B"]);
  });

  it("says nothing where they share no end, since there is no corner", () => {
    expect(cornerOf(SOUTH, FAR)).toBe(null);
  });

  /** Two objects on the same two points say no angle: either end would do. */
  it("says nothing where they share both ends", () => {
    const over: SketchObject = { ...lineThrough("segment", ["A", "B"]), id: "over" };
    expect(cornerOf(EAST, over)).toBe(null);
  });

  /** A parallel is drawn off another object, so it has no two ends to name. */
  it("says nothing where either has no ends to name", () => {
    const beside: SketchObject = {
      ...createLine("line", { kind: "parallel", at: "C", to: "east" }),
      id: "beside",
    };
    expect(cornerOf(beside, SOUTH)).toBe(null);
    expect(cornerOf(SOUTH, beside)).toBe(null);
  });
});
