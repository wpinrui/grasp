// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createInterior,
  createPoint,
  createWedge,
  type SketchObject,
  settle,
} from "../../sketch/model";
import { arcPath, arrowPoints, interiorShape, wedgePath } from "./shapes";

/**
 * The path strings the sheet is drawn with. The sheet's own snapshot reaches
 * one of these, the curved form of an arc; the straight form, both wedges and
 * the arrowhead are drawn only by figures it never lays out.
 */

/** A quarter turn anticlockwise about the origin, radius 10. */
const ARC = {
  at: { x: 0, y: 0 },
  radius: 10,
  from: 0,
  sweep: -Math.PI / 2,
  ref: 0,
};

/** The degenerate arc: three points in a line, which has no curve to draw. */
const FLAT = {
  ...ARC,
  flat: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ] as [{ x: number; y: number }, { x: number; y: number }],
};

describe("an arc as a path", () => {
  it("draws a straight one as the line it is", () => {
    expect(arcPath(FLAT)).toBe("M 0 0 L 10 0");
  });

  /** A sweep the positive way is clockwise on screen, which is SVG's flag. */
  it("says which way round it goes", () => {
    expect(arcPath(ARC).endsWith(" 0 0 0 -10")).toBe(false);
    expect(arcPath(ARC)).toContain(" A 10 10 0 0 0 ");
    expect(arcPath({ ...ARC, sweep: Math.PI / 2 })).toContain(" A 10 10 0 0 1 ");
  });

  it("says when it goes the long way round", () => {
    expect(arcPath({ ...ARC, sweep: -Math.PI / 2 })).toContain(" 0 0 0 ");
    expect(arcPath({ ...ARC, sweep: -Math.PI * 1.5 })).toContain(" 0 1 0 ");
  });
});

describe("the fill cut out of an arc", () => {
  it("takes a sector back to the centre", () => {
    expect(wedgePath(ARC, "sector")).toBe(`${arcPath(ARC)} L 0 0 Z`);
  });

  it("closes a segment across its own chord", () => {
    expect(wedgePath(ARC, "segment")).toBe(`${arcPath(ARC)} Z`);
  });
});

describe("the arrowhead a locus is dragged by", () => {
  const handle = {
    locus: "loc",
    end: 0 as const,
    at: { x: 0, y: 0 },
    way: { x: 1, y: 0 },
    step: 0.01,
  };

  /** It keeps its size on screen, so twice the zoom is half the sheet size. */
  it("halves on the sheet as the sheet doubles on screen", () => {
    const wide = arrowPoints(handle, 1)
      .split(" ")
      .map((spot) => Number(spot.split(",")[0]));
    const close = arrowPoints(handle, 2)
      .split(" ")
      .map((spot) => Number(spot.split(",")[0]));
    expect(wide[0]).toBe(0);
    expect(close[0]).toBe(0);
    expect(close[1]).toBeCloseTo(wide[1] / 2);
  });

  it("puts its tip where the handle is, and its back up the way it points", () => {
    const [tip, left, right] = arrowPoints(handle, 1).split(" ");
    expect(tip).toBe("0,0");
    expect(left.split(",")[0]).toBe(right.split(",")[0]);
    expect(Number(left.split(",")[1])).toBeCloseTo(-Number(right.split(",")[1]));
  });
});

describe("the shape a fill comes out as", () => {
  const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
  const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
  const C = { ...createPoint({ x: 0, y: 100 }, "medium"), id: "C" };

  it("gives a polygon its corners", () => {
    const fill = { ...createInterior(["A", "B", "C"]), id: "poly" };
    const objects: SketchObject[] = [A, B, C, fill];
    expect(interiorShape(fill, settle(objects).settled)).toEqual({
      kind: "polygon",
      points: "0,0 100,0 0,100",
    });
  });

  it("gives nothing where the figure has not settled", () => {
    const fill = { ...createInterior(["A", "gone"]), id: "empty" };
    expect(interiorShape(fill, settle([A, fill]).settled)).toBe(null);
  });

  it("cuts a wedge out of the arc it is the inside of", () => {
    const wedge = { ...createWedge("arc", "sector"), id: "slice" };
    const settled = settle([wedge]).settled;
    settled.arcs.set("arc", ARC);
    const shape = interiorShape(wedge, settled);
    expect(shape).toEqual({ kind: "path", d: wedgePath(ARC, "sector") });
  });
});
