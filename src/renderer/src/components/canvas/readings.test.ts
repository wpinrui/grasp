// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createMeasurement,
  createPoint,
  distance,
  lineThrough,
  markReach,
  type SketchMark,
  type SketchMeasurement,
  type SketchObject,
  settle,
} from "../../sketch/model";
import { type Measuring, pointUnder, readingAlready, readingFrom, sameAngle } from "./readings";

/**
 * What the Measure tool would write, and where it hangs. Nothing here is pinned
 * by the sheet's own snapshot: the tool is never up in it, and the one entry
 * point it does reach has its answer thrown away by the first guard in the
 * dimension drawing.
 */

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
const C = { ...createPoint({ x: 0, y: 100 }, "medium"), id: "C" };
const SEGMENT = { ...lineThrough("segment", ["A", "B"]), id: "seg" };
const ARM = { ...lineThrough("segment", ["A", "C"]), id: "arm" };
const FIGURE: SketchObject[] = [A, B, C, SEGMENT, ARM];

function measuring(measure: string | null, objects: SketchObject[] = FIGURE): Measuring {
  return {
    objects,
    settled: settle(objects).settled,
    scale: 1,
    measure,
    saying: () => "5 cm",
    lastMark: { angle: 1, radius: 24 },
    clearOf: () => 24,
  };
}

describe("the same reading twice", () => {
  it("reads three points about the same corner either way round", () => {
    expect(sameAngle(["B", "A", "C"], ["C", "A", "B"])).toBe(true);
    expect(sameAngle(["B", "A", "C"], ["B", "C", "A"])).toBe(false);
  });

  it("finds the number already on the sheet rather than laying another", () => {
    const already = createMeasurement("length", ["seg"], { x: 40, y: -30 });
    const written = {
      reading: createMeasurement("length", ["seg"], { x: 0, y: 0 }) as SketchMeasurement,
      mark: null,
    };
    expect(readingAlready(written, measuring("length", [...FIGURE, already]))?.id).toBe(already.id);
    expect(readingAlready(written, measuring("length"))).toBe(null);
  });
});

describe("what a click would read", () => {
  it("reads nothing off bare sheet", () => {
    expect(readingFrom({ x: 400, y: 400 }, measuring("length"))).toBe(null);
  });

  it("reads nothing while the tool is armed with something else", () => {
    expect(readingFrom({ x: 50, y: 0 }, measuring("area"))).toBe(null);
    expect(readingFrom({ x: 50, y: 0 }, measuring(null))).toBe(null);
  });

  /**
   * The number lands beside what it reads rather than at the pointer, so the
   * figure is not covered by the number taken off it.
   */
  it("hangs a length off the segment rather than on it", () => {
    const written = readingFrom({ x: 50, y: 0 }, measuring("length"));
    expect(written?.reading.measure).toBe("length");
    expect(written?.reading.of).toEqual(["seg"]);
    expect(Math.abs(written?.reading.y ?? 0)).toBeGreaterThan(0);
    expect(written?.mark).toBe(null);
  });

  /**
   * An angle has to be marked before it can be read: the arcs say which of the
   * angles at that corner the number is about.
   */
  it("marks an angle before reading it, and reads it off the corner", () => {
    const written = readingFrom({ x: 0, y: 0 }, measuring("angle"));
    expect(written?.reading.measure).toBe("angle");
    expect(written?.reading.of).toEqual(["B", "A", "C"]);
    expect(written?.mark).not.toBe(null);
  });

  /**
   * The number goes outside the marking on the angle, so a corner whose marks
   * stand further out pushes the number further out with them.
   */
  it("stands the number clear of the marking on the corner", () => {
    const near = readingFrom({ x: 0, y: 0 }, { ...measuring("angle"), clearOf: () => 24 });
    const far = readingFrom({ x: 0, y: 0 }, { ...measuring("angle"), clearOf: () => 120 });
    const outOf = (written: typeof near) =>
      distance({ x: written?.reading.x ?? 0, y: written?.reading.y ?? 0 }, A);
    expect(outOf(near)).toBeGreaterThan(markReach(near?.mark as SketchMark));
    expect(outOf(far)).toBeGreaterThan(outOf(near) + 90);
  });
});

describe("what is under the pointer", () => {
  it("finds a point under the pointer, and nothing out on bare sheet", () => {
    expect(pointUnder({ x: 1, y: 1 }, measuring(null))?.id).toBe("A");
    expect(pointUnder({ x: 50, y: 50 }, measuring(null))).toBe(null);
  });
});
