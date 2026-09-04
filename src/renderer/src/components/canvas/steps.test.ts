// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createPoint,
  degreesOf,
  distance,
  lineThrough,
  type Position,
  PX_PER_CM,
  type SketchObject,
  settle,
} from "../../sketch/model";
import type { Snapping } from "../SnapPanel";
import { type Aiming, aimAt, handleAt, snapAt, spanOfLocus } from "./steps";

/**
 * Where a click lands is the one thing on the sheet with no second opinion: it
 * is not drawn, so nothing pins it but this. The snapshot over in
 * `Canvas.test.tsx` runs with every step switched off, which reaches the guards
 * and nothing past them, so the stepping itself is checked here.
 */

/** Two points with a segment between them, running east out of the origin. */
const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 300, y: 0 }, "medium"), id: "B" };
const SEGMENT = { ...lineThrough("segment", ["A", "B"]), id: "seg" };
const FIGURE: SketchObject[] = [A, B, SEGMENT];

/** An arm out of A at 20 degrees, so a 30 degree step off it is not off the horizontal. */
const C = { ...createPoint({ x: 93.9693, y: 34.202 }, "medium"), id: "C" };
const ARM = { ...lineThrough("segment", ["A", "C"]), id: "arm" };
const ARMED: SketchObject[] = [A, C, ARM];

/** A pointer at 55 degrees, which is 50 off the arm and 60 off the horizontal. */
const AIM = { x: 57.3576, y: 81.9152 };

const OFF: Snapping = {
  objects: false,
  length: false,
  lengthCm: 0,
  angle: false,
  angleDegrees: 0,
  moving: false,
};

function aiming(snapping: Partial<Snapping>, half: Partial<Aiming> = {}): Aiming {
  const objects = (half.objects ?? FIGURE) as SketchObject[];
  return {
    objects,
    settled: settle(objects).settled,
    scale: 1,
    slack: 5,
    snapping: { ...OFF, ...snapping },
    handles: [],
    pending: null,
    tracing: null,
    shiftHeld: false,
    present: () => objects,
    ...half,
  };
}

/** How far the aimed spot is from the start, in whole centimetres. */
function cmFrom(from: Position, spot: Position): number {
  return distance(from, spot) / PX_PER_CM;
}

describe("what a click lands on", () => {
  it("takes a point already there over the path it sits on", () => {
    const found = snapAt({ x: 2, y: 1 }, aiming({}));
    expect(found?.kind).toBe("point");
    expect(found?.ids).toEqual(["A"]);
  });

  it("takes the path under the pointer where no point is there", () => {
    const found = snapAt({ x: 150, y: 2 }, aiming({}));
    expect(found?.kind).toBe("line");
    expect(found?.ids).toEqual(["seg"]);
    expect(found?.at.y).toBeCloseTo(0);
  });

  it("finds nothing out on bare sheet", () => {
    expect(snapAt({ x: 150, y: 400 }, aiming({}))).toBe(null);
  });

  it("looks for nothing at all when object snapping is off", () => {
    const at = { x: 2, y: 1 };
    expect(aimAt(at, aiming({ objects: false })).found).toBe(null);
    expect(aimAt(at, aiming({ objects: true })).found?.kind).toBe("point");
  });
});

describe("the steps a click is held to", () => {
  const from = { x: 0, y: 0 };
  const pending = { start: from, startId: "A", at: from, tool: "straightedge" };

  it("holds the run to whole steps of length", () => {
    const aim = aimAt(
      { x: 2.4 * PX_PER_CM, y: 0 },
      aiming({ length: true, lengthCm: 1 }, { pending, objects: [A] }),
    );
    expect(cmFrom(from, aim.spot)).toBeCloseTo(2);
  });

  it("never holds a run down to nothing, so a line is always drawn", () => {
    const aim = aimAt(
      { x: 0.2 * PX_PER_CM, y: 0 },
      aiming({ length: true, lengthCm: 1 }, { pending, objects: [A] }),
    );
    expect(cmFrom(from, aim.spot)).toBeCloseTo(1);
  });

  it("holds the bearing to whole steps of angle", () => {
    const aim = aimAt(
      { x: 100, y: 60 },
      aiming({ angle: true, angleDegrees: 45 }, { pending, objects: [A] }),
    );
    expect(degreesOf(Math.atan2(aim.spot.y, aim.spot.x))).toBeCloseTo(45);
  });

  /**
   * With a bare corner the steps are counted off the horizontal; with an arm
   * already there they are counted off the arm. The arm below is at 20 degrees
   * and the step is 30, so the two answers differ, which is what makes this a
   * test of the arm rather than of a coincidence.
   */
  it("counts the angle off the arm already at the corner", () => {
    const stepped = { angle: true, angleDegrees: 30 };
    const bare = aimAt({ x: AIM.x, y: AIM.y }, aiming(stepped, { pending, objects: [A] }));
    expect(degreesOf(Math.atan2(bare.spot.y, bare.spot.x))).toBeCloseTo(60);

    const armed = aimAt({ x: AIM.x, y: AIM.y }, aiming(stepped, { pending, objects: ARMED }));
    expect(degreesOf(Math.atan2(armed.spot.y, armed.spot.x))).toBeCloseTo(50);
  });

  it("leaves the pointer alone with every step off", () => {
    const at = { x: 137, y: 41 };
    expect(aimAt(at, aiming({}, { pending, objects: [A] })).spot).toEqual(at);
  });

  it("holds to Shift's own step instead, while Shift is down", () => {
    const aim = aimAt({ x: 100, y: 12 }, aiming({ objects: true }, { pending, shiftHeld: true }));
    expect(aim.found).toBe(null);
    expect(degreesOf(Math.atan2(aim.spot.y, aim.spot.x))).toBeCloseTo(0);
  });
});

describe("what a drag takes hold of", () => {
  it("finds no arrowhead where the sheet carries none", () => {
    expect(handleAt({ x: 0, y: 0 }, aiming({}))).toBe(null);
  });

  it("reads a whole domain off anything that is not a locus", () => {
    expect(spanOfLocus("seg", aiming({}))).toEqual([0, 1]);
  });
});
