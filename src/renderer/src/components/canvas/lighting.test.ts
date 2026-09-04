// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createAngleMark,
  createMeasurement,
  createPoint,
  lineThrough,
  type SketchObject,
} from "../../sketch/model";
import { litWith } from "./lighting";

/**
 * Lighting an object up. The sheet's own snapshot reaches only the plain case,
 * where what is lit is what was asked for; the marks, the angle readings and
 * the ids that name nothing are covered here.
 */

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
const C = { ...createPoint({ x: 0, y: 100 }, "medium"), id: "C" };
const D = { ...createPoint({ x: 100, y: 100 }, "medium"), id: "D" };
/** The two arms of the angle at A, and one line that has nothing to do with it. */
const EAST = { ...lineThrough("segment", ["A", "B"]), id: "east" };
const SOUTH = { ...lineThrough("segment", ["A", "C"]), id: "south" };
const AWAY = { ...lineThrough("segment", ["B", "D"]), id: "away" };
/** Out of the corner, but to neither arm, so it is not what the angle is about. */
const OFF_ARM = { ...lineThrough("segment", ["A", "D"]), id: "off-arm" };

const ANGLE = {
  ...createMeasurement("angle", ["B", "A", "C"], { x: 20, y: 20 }),
  id: "reading",
};
const LENGTH = { ...createMeasurement("length", ["east"], { x: 50, y: 10 }), id: "long" };
const MARK = {
  ...createAngleMark({
    corner: "A",
    arms: ["B", "C"],
    sides: ["east", "south"],
    strokes: 1,
    reflex: false,
    radius: 24,
  }),
  id: "mark",
};

const FIGURE: SketchObject[] = [A, B, C, D, EAST, SOUTH, AWAY, OFF_ARM, ANGLE, LENGTH, MARK];

describe("what lighting an object up should light", () => {
  it("lights an ordinary object and nothing else", () => {
    expect(litWith("east", FIGURE)).toEqual(["east"]);
  });

  it("lights an id it has never heard of, rather than nothing", () => {
    expect(litWith("gone", FIGURE)).toEqual(["gone"]);
  });

  /**
   * An angle mark knows its own two sides, and those are what say which angle
   * at the corner is meant.
   */
  it("lights an angle mark with the sides it was made against", () => {
    expect(litWith("mark", FIGURE)).toEqual(["mark", "east", "south"]);
  });

  /**
   * An angle reading is three points and nothing else, which would light three
   * dots and leave the reader to work out which angle was meant.
   */
  it("lights an angle reading with the arms it runs between", () => {
    expect(litWith("reading", FIGURE)).toEqual(["reading", "east", "south"]);
  });

  it("leaves out a line that misses the corner, or misses both arms", () => {
    const lit = litWith("reading", FIGURE);
    expect(lit).not.toContain("away");
    expect(lit).not.toContain("off-arm");
  });

  it("lights a reading that is not an angle on its own", () => {
    expect(litWith("long", FIGURE)).toEqual(["long"]);
  });
});
