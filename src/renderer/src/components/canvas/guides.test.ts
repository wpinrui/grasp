// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPoint, lineThrough, type SketchObject, settle } from "../../sketch/model";
import type { Snapping } from "../SnapPanel";
import { guideOf, type Placing } from "./guides";

/**
 * What a half-drawn object says about itself. None of it is ever in the sheet's
 * own snapshot: a guide is there only while something is being placed, and
 * nothing is half drawn in a rendered figure.
 */

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
const SEGMENT = { ...lineThrough("segment", ["A", "B"]), id: "seg" };
const FIGURE: SketchObject[] = [A, B, SEGMENT];

const SNAPPING: Snapping = {
  objects: true,
  length: false,
  lengthCm: 0,
  angle: false,
  angleDegrees: 0,
  moving: true,
};

function placing(half: Partial<Placing> = {}): Placing {
  const objects = half.objects ?? FIGURE;
  return {
    objects,
    settled: settle(objects).settled,
    scale: 1,
    snapping: SNAPPING,
    travel: null,
    pending: null,
    tracing: null,
    ...half,
  };
}

describe("what a half-drawn object says", () => {
  it("says nothing at all while nothing is being placed", () => {
    expect(guideOf(placing())).toBe(null);
  });

  it("gives a circle its radius, on a run to sit on and with no angle", () => {
    const guide = guideOf(
      placing({ pending: { start: A, startId: "A", at: { x: 60, y: 0 }, tool: "compass" } }),
    );
    expect(guide?.length.text).toContain("cm");
    expect(guide?.corners).toEqual([]);
    expect(guide?.travel).toEqual({ from: A, to: { x: 60, y: 0 } });
  });

  /**
   * A line out of a bare point is read off the horizontal, so the guide carries
   * the datum that horizontal runs from. Out of a point with something already
   * at it there is no datum, because the angle is against what is drawn.
   */
  it("reads a line off the horizontal only where the corner is bare", () => {
    const bare = guideOf(
      placing({
        objects: [A],
        pending: { start: A, startId: "A", at: { x: 60, y: 60 }, tool: "straightedge" },
      }),
    );
    expect(bare?.datum).toEqual(A);

    const armed = guideOf(
      placing({ pending: { start: A, startId: "A", at: { x: 60, y: 60 }, tool: "straightedge" } }),
    );
    expect(armed?.datum).toBeUndefined();
    expect(armed?.corners).toHaveLength(1);
  });

  it("says how far a move has gone and which way", () => {
    const guide = guideOf(placing({ travel: { from: A, to: { x: 30, y: 40 } } }));
    expect(guide?.travel).toEqual({ from: A, to: { x: 30, y: 40 } });
    expect(guide?.datum).toEqual(A);
    expect(guide?.corners).toHaveLength(1);
  });

  it("says nothing about a move that nothing is holding", () => {
    const free = { ...SNAPPING, moving: false };
    expect(guideOf(placing({ snapping: free, travel: { from: A, to: { x: 30, y: 0 } } }))).toBe(
      null,
    );
  });

  /**
   * A polygon reads every corner of the shape as it stands, so the whole figure
   * can be read while it is being laid rather than one angle at a time, and it
   * says the area it would close at once there is one.
   */
  it("reads every corner of a polygon being traced, and its area", () => {
    const guide = guideOf(
      placing({
        tracing: {
          ids: ["A", "B"],
          spots: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          at: { x: 0, y: 100 },
        },
      }),
    );
    expect(guide?.corners).toHaveLength(3);
    expect(guide?.area?.text).toBeTruthy();
    expect(guide?.datum).toBeUndefined();
  });

  it("reads the first edge of a polygon off the horizontal, with no area yet", () => {
    const guide = guideOf(
      placing({ tracing: { ids: ["A"], spots: [{ x: 0, y: 0 }], at: { x: 100, y: 40 } } }),
    );
    expect(guide?.corners).toHaveLength(1);
    expect(guide?.datum).toEqual({ x: 0, y: 0 });
    expect(guide?.area).toBeUndefined();
  });
});
