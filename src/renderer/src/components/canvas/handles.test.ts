// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createLocus,
  createPoint,
  type LocusShape,
  lineThrough,
  type SketchObject,
  settle,
} from "../../sketch/model";
import { handlesOn } from "./handles";

/**
 * The arrowheads a locus is dragged by. The sheet's own snapshot reaches none
 * of this: the locus it lays out runs along a segment, which fixes both ends,
 * so there is nothing to drag it by.
 */

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
const D = { ...createPoint({ x: 50, y: 50 }, "medium"), id: "D" };

/** The domain the driver walks, in each of the three forms a line comes in. */
function domain(form: "segment" | "ray" | "line") {
  return { ...lineThrough(form, ["A", "B"]), id: "dom" };
}

/** A locus over that domain, walked over the stretch given. */
function locus(span: [number, number] = [0, 1]) {
  return {
    ...createLocus({ driver: "A", domain: "dom", driven: "D", span, samples: 4 }),
    id: "loc",
  };
}

/** The figure, with the locus's shape planted where it settled. */
function drawn(form: "segment" | "ray" | "line", shape: LocusShape, span?: [number, number]) {
  const objects: SketchObject[] = [A, B, D, domain(form), locus(span)];
  const settled = settle(objects).settled;
  settled.loci.set("loc", shape);
  return { objects, settled };
}

/** A locus drawn as its samples, running north-east away from the origin. */
const SAMPLED: LocusShape = {
  kind: "points",
  at: [
    { x: 0, y: 0 },
    { x: 30, y: 30 },
    { x: 60, y: 60 },
  ],
};

/** One drawn as circles, which has no one end of its own to sit at. */
const ROUND: LocusShape = { kind: "circles", at: [{ at: { x: 0, y: 0 }, radius: 5, ref: 0 }] };

describe("how many ends a locus can be dragged by", () => {
  it("gives a segment none, both its ends being fixed already", () => {
    expect(handlesOn(drawn("segment", SAMPLED))).toEqual([]);
  });

  it("gives a ray one, at the end it runs off to", () => {
    const found = handlesOn(drawn("ray", SAMPLED));
    expect(found).toHaveLength(1);
    expect(found[0].end).toBe(1);
  });

  it("gives a line both", () => {
    expect(handlesOn(drawn("line", SAMPLED)).map((handle) => handle.end)).toEqual([0, 1]);
  });

  it("gives nothing to a domain too short to walk", () => {
    const objects: SketchObject[] = [A, { ...A, id: "B", x: 0.5 }, D, domain("line"), locus()];
    const settled = settle(objects).settled;
    settled.loci.set("loc", SAMPLED);
    expect(handlesOn({ objects, settled })).toEqual([]);
  });
});

describe("where an arrowhead sits and which way it points", () => {
  /** A point locus carries its arrowhead at the end of the curve it drew. */
  it("puts a sampled locus's head at the end of the curve, pointing on", () => {
    const found = handlesOn(drawn("line", SAMPLED));
    const far = found.find((handle) => handle.end === 1);
    expect(far?.at).toEqual({ x: 60, y: 60 });
    expect(far?.way.x).toBeCloseTo(Math.SQRT1_2);
    expect(far?.way.y).toBeCloseTo(Math.SQRT1_2);
  });

  it("turns the near end's arrowhead round to point the other way", () => {
    const near = handlesOn(drawn("line", SAMPLED)).find((handle) => handle.end === 0);
    expect(near?.at).toEqual({ x: 0, y: 0 });
    expect(near?.way.x).toBeCloseTo(-Math.SQRT1_2);
    expect(near?.way.y).toBeCloseTo(-Math.SQRT1_2);
  });

  /**
   * Two samples on top of one another say nothing about which way the curve was
   * going, so the domain's own direction is used instead.
   */
  it("falls back to the domain's direction where the curve doubled back on itself", () => {
    const still: LocusShape = {
      kind: "points",
      at: [
        { x: 10, y: 10 },
        { x: 10, y: 10 },
      ],
    };
    const found = handlesOn(drawn("line", still));
    const far = found.find((handle) => handle.end === 1);
    expect(far?.way).toEqual({ x: 1, y: 0 });
    expect(found.find((handle) => handle.end === 0)?.way).toEqual({ x: -1, y: -0 });
  });

  /**
   * Anything not drawn as samples has no one end of its own, so the arrowhead
   * sits on the domain, at the far end of the stretch the driver runs over.
   */
  it("sits on the domain where the locus is not drawn as samples", () => {
    const found = handlesOn(drawn("line", ROUND, [0.25, 0.75]));
    expect(found.find((handle) => handle.end === 0)?.at).toEqual({ x: 25, y: 0 });
    expect(found.find((handle) => handle.end === 1)?.at).toEqual({ x: 75, y: 0 });
  });

  it("says how much domain a pixel of drag is worth", () => {
    expect(handlesOn(drawn("line", SAMPLED))[0].step).toBeCloseTo(1 / 100);
  });
});
