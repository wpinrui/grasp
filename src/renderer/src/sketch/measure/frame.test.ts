// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Position, SketchObject } from "../model";
import {
  createArc,
  createCircle,
  createFill,
  createInterior,
  createLine,
  createMeasurement,
  createPoint,
  createWedge,
  settle,
} from "../model";
import { frameOf, spotIn, spotOf } from "./frame";

/**
 * The frame a tied number hangs in. It is built out of the settled figure, so
 * moving or turning the figure moves and turns the frame, and a number holding
 * its place in one rides along instead of being left behind. The offset itself
 * is in sheet units: the gap a number stands off its figure is a drawing
 * convention rather than a part of the figure, so it does not grow with it.
 */
describe("the frame a reading hangs in", () => {
  function framed(reading: SketchObject, objects: SketchObject[]) {
    const page = settle(objects);
    return frameOf(reading as never, page.objects, page.settled);
  }

  /** A number hung at one spot on one figure, and the figure it is carried to. */
  interface Carrying {
    reading: SketchObject;
    at: Position;
    before: SketchObject[];
    after: SketchObject[];
  }

  /** Where a number hung at that spot on the first figure lands on the second. */
  function carried({ reading, at, before, after }: Carrying): Position {
    const first = framed(reading, before);
    const second = framed(reading, after);
    if (!first || !second) throw new Error("no frame");
    return spotIn(second, spotOf(first, at));
  }

  const a = createPoint({ x: 0, y: 0 }, "medium");
  const b = createPoint({ x: 100, y: 0 }, "medium");
  const seg = createLine("segment", { kind: "through", ends: [a.id, b.id] });
  const length = createMeasurement("length", [seg.id], { x: 50, y: -20 });

  it("measures a segment from the middle of it", () => {
    const frame = framed(length, [a, b, seg, length]);
    expect(frame?.at).toEqual({ x: 50, y: 0 });
  });

  it("holds the gap off the segment as the segment grows", () => {
    // A number hung to one side keeps both offsets, so a dimension stands the
    // distance clear of its segment that it was drawn to stand rather than
    // being thrown out as the segment lengthens.
    const longer = { ...b, x: 300 };
    const at = carried({
      reading: length,
      at: { x: 90, y: -20 },
      before: [a, b, seg, length],
      after: [a, longer, seg, length],
    });
    expect(at.x).toBeCloseTo(190);
    expect(at.y).toBeCloseTo(-20);
  });

  it("keeps a number over the middle when the segment is stretched", () => {
    const longer = { ...b, x: 300 };
    const at = carried({
      reading: length,
      at: { x: 50, y: -20 },
      before: [a, b, seg, length],
      after: [a, longer, seg, length],
    });
    // Over the middle of the longer segment, and the same distance clear of it.
    expect(at.x).toBeCloseTo(150);
    expect(at.y).toBeCloseTo(-20);
  });

  it("swings a number round with the segment", () => {
    // The same segment stood on end. The number was 20 above the middle of a
    // segment running to the right; it is now 20 to one side of a segment
    // running down, having turned with it.
    const upright = { ...b, x: 0, y: 100 };
    const at = carried({
      reading: length,
      at: { x: 50, y: -20 },
      before: [a, b, seg, length],
      after: [a, upright, seg, length],
    });
    expect(at.x).toBeCloseTo(20);
    expect(at.y).toBeCloseTo(50);
  });

  it("hands a spot back unchanged where nothing has moved", () => {
    const page = [a, b, seg, length];
    const at = carried({ reading: length, at: { x: 63, y: -41 }, before: page, after: page });
    expect(at.x).toBeCloseTo(63);
    expect(at.y).toBeCloseTo(-41);
  });

  it("measures an angle from its corner, out along the bisector", () => {
    const corner = createPoint({ x: 0, y: 0 }, "medium");
    const arm = createPoint({ x: 100, y: 0 }, "medium");
    const other = createPoint({ x: 0, y: 100 }, "medium");
    const angle = createMeasurement("angle", [arm.id, corner.id, other.id], { x: 30, y: 30 });
    const frame = framed(angle, [corner, arm, other, angle]);
    expect(frame?.at).toEqual({ x: 0, y: 0 });
    // The bisector of a right angle between those two arms, and one whole way
    // along is the mean of the arms.
    expect(frame?.along.x).toBeCloseTo(Math.SQRT1_2);
    expect(frame?.along.y).toBeCloseTo(Math.SQRT1_2);
  });

  it("reads a reflex angle from the other side of the corner", () => {
    const corner = createPoint({ x: 0, y: 0 }, "medium");
    const arm = createPoint({ x: 100, y: 0 }, "medium");
    const other = createPoint({ x: 0, y: 100 }, "medium");
    const of = [arm.id, corner.id, other.id];
    const angle = createMeasurement("angle", of, { x: 30, y: 30 });
    const round = { ...angle, reflex: true };
    const frame = framed(round, [corner, arm, other, round]);
    // The arc of the reflex angle is the rest of the turn, so it and its
    // number sit opposite the arc of the angle itself.
    expect(frame?.along.x).toBeCloseTo(-Math.SQRT1_2);
    expect(frame?.along.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it("swings a number round as an angle opens", () => {
    const corner = createPoint({ x: 0, y: 0 }, "medium");
    const arm = createPoint({ x: 100, y: 0 }, "medium");
    const other = createPoint({ x: 0, y: 100 }, "medium");
    const of = [arm.id, corner.id, other.id];
    const angle = createMeasurement("angle", of, { x: 30, y: 30 });
    const before = [corner, arm, other, angle];
    // The second arm swung from a quarter turn out to three eighths, so the
    // bisector goes from an eighth of a turn to three sixteenths and the number
    // swings with it. It stays the same 40 off the corner, which is the
    // clearance the arc is drawn to rather than something the arms set.
    const opened = { ...other, x: -100 * Math.SQRT1_2, y: 100 * Math.SQRT1_2 };
    const after = [corner, arm, opened, angle];
    const on = { x: 40 * Math.SQRT1_2, y: 40 * Math.SQRT1_2 };
    const at = carried({ reading: angle, at: on, before, after });
    expect(Math.hypot(at.x, at.y)).toBeCloseTo(40);
    expect(Math.atan2(at.y, at.x)).toBeCloseTo((3 * Math.PI) / 8);
  });

  it("squares up to the arms where an angle is a straight one", () => {
    // Two arms straight out either way have no bisector to speak of: every way
    // round lies as much between them as any other. The frame stands square to
    // the arms rather than coming out as nothing at all.
    const corner = createPoint({ x: 0, y: 0 }, "medium");
    const arm = createPoint({ x: 100, y: 0 }, "medium");
    const other = createPoint({ x: -100, y: 0 }, "medium");
    const angle = createMeasurement("angle", [arm.id, corner.id, other.id], { x: 0, y: 40 });
    const frame = framed(angle, [corner, arm, other, angle]);
    expect(frame?.along.x).toBeCloseTo(0);
    expect(Math.abs(frame?.along.y ?? 0)).toBeCloseTo(1);
  });

  it("measures a shape from the middle of its corners", () => {
    const corners = [
      createPoint({ x: 0, y: 0 }, "medium"),
      createPoint({ x: 60, y: 0 }, "medium"),
      createPoint({ x: 60, y: 60 }, "medium"),
      createPoint({ x: 0, y: 60 }, "medium"),
    ];
    const fill = createInterior(corners.map((corner) => corner.id));
    const area = createMeasurement("area", [fill.id], { x: 30, y: 30 });
    const frame = framed(area, [...corners, fill, area]);
    expect(frame?.at).toEqual({ x: 30, y: 30 });
  });

  it("measures a circle from its centre", () => {
    const centre = createPoint({ x: 40, y: 40 }, "medium");
    const rim = createPoint({ x: 90, y: 40 }, "medium");
    const round = createCircle({ kind: "through", centre: centre.id, edge: rim.id });
    const across = createMeasurement("radius", [round.id], { x: 40, y: 10 });
    const frame = framed(across, [centre, rim, round, across]);
    expect(frame?.at).toEqual({ x: 40, y: 40 });
  });

  it("measures the inside of a circle from the circle's centre", () => {
    const centre = createPoint({ x: 40, y: 40 }, "medium");
    const rim = createPoint({ x: 90, y: 40 }, "medium");
    const round = createCircle({ kind: "through", centre: centre.id, edge: rim.id });
    const inside = createFill(round.id);
    const area = createMeasurement("area", [inside.id], { x: 40, y: 40 });
    const frame = framed(area, [centre, rim, round, inside, area]);
    expect(frame?.at).toEqual({ x: 40, y: 40 });
  });

  it("measures a sector from the centre, out through the middle of the arc", () => {
    const centre = createPoint({ x: 0, y: 0 }, "medium");
    const from = createPoint({ x: 100, y: 0 }, "medium");
    const to = createPoint({ x: 0, y: 100 }, "medium");
    const bend = createArc({ kind: "centre", centre: centre.id, from: from.id, to: to.id });
    const wedge = createWedge(bend.id, "sector");
    const area = createMeasurement("area", [wedge.id], { x: 20, y: 20 });
    const frame = framed(area, [centre, from, to, bend, wedge, area]);
    expect(frame?.at).toEqual({ x: 0, y: 0 });
    // Halfway between those two ends, whichever way round the arc is swept.
    expect(Math.abs(frame?.along.x ?? 0)).toBeCloseTo(Math.SQRT1_2);
    expect(Math.abs(frame?.along.y ?? 0)).toBeCloseTo(Math.SQRT1_2);
  });

  it("gives no frame where what it reads is not there", () => {
    const orphan = createMeasurement("length", ["gone"], { x: 0, y: 0 });
    expect(framed(orphan, [orphan])).toBe(null);
  });
});
