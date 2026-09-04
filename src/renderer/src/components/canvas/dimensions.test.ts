// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createMeasurement,
  createPoint,
  lineThrough,
  type SketchMeasurement,
  type SketchObject,
  settle,
} from "../../sketch/model";
import { dimensionOf } from "./dimensions";

/**
 * A dimension is drawn out of nothing but the reading and the segment under it,
 * and the sheet's own snapshot never reaches it: the figure it lays out has no
 * bounded length on it, so `dimensionOf` returns on its first guard there.
 */

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
const SEGMENT = { ...lineThrough("segment", ["A", "B"]), id: "seg" };
const FIGURE: SketchObject[] = [A, B, SEGMENT];

const DRAWING = { settled: settle(FIGURE).settled, scale: 1 };
const BOX = { width: 40, height: 20 };

/** The reading, hung above the segment, as the tool would write it. */
function reading(more: Partial<SketchMeasurement> = {}): SketchMeasurement {
  return { ...createMeasurement("length", ["seg"], { x: 30, y: -40 }), ...more };
}

/** How many separate runs a path string is made of. */
function runs(path: string): number {
  return path.split("M").length - 1;
}

describe("drawing a length out", () => {
  it("draws nothing at all until it is asked to be drawn out", () => {
    expect(dimensionOf(reading(), BOX, DRAWING)).toBe(null);
  });

  it("draws nothing for a reading that is not a length", () => {
    const area = { ...createMeasurement("area", ["seg"], { x: 0, y: 0 }), bounds: "full" } as const;
    expect(dimensionOf(area, BOX, DRAWING)).toBe(null);
  });

  it("draws one run and two heads in the full form", () => {
    const drawn = dimensionOf(reading({ bounds: "full" }), BOX, DRAWING);
    expect(drawn?.heads).toHaveLength(2);
    expect(drawn?.lines).toHaveLength(1);
    expect(runs(drawn?.lines[0] ?? "")).toBe(1);
  });

  /**
   * Broken by the number: the run stops either side of the room the number
   * takes along the dimension, so nothing is drawn under it.
   */
  it("breaks the run either side of the number in the broken form", () => {
    const drawn = dimensionOf(reading({ bounds: "broken" }), BOX, DRAWING);
    expect(drawn?.lines).toHaveLength(2);
    expect(drawn?.heads).toHaveLength(2);
  });

  it("draws the dotted lines only when it carries them", () => {
    expect(dimensionOf(reading({ bounds: "full" }), BOX, DRAWING)?.dotted).toEqual([]);
    const led = dimensionOf(reading({ bounds: "full", leaders: true }), BOX, DRAWING);
    expect(led?.dotted).toHaveLength(2);
  });

  /**
   * The run follows the number rather than the segment, so dragging the number
   * to the other side of the segment takes the whole dimension with it.
   */
  it("puts the run on whichever side the number was dragged to", () => {
    const above = dimensionOf(reading({ bounds: "full" }), BOX, DRAWING);
    const below = dimensionOf(reading({ bounds: "full", y: 40 }), BOX, DRAWING);
    expect(above?.lines[0]).not.toBe(below?.lines[0]);
    const y = (path: string) => Number(path.split(" ")[2]);
    expect(y(above?.lines[0] ?? "")).toBeLessThan(0);
    expect(y(below?.lines[0] ?? "")).toBeGreaterThan(0);
  });
});
