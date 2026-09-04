// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SketchObject } from "../model";
import { createLine, createMeasurement, createPoint } from "../model";
import { spelledOutBy } from "./reading";

/**
 * Taking a measurement labels whatever its reading names, so a new reading
 * never comes out saying "?? = 5 cm". Which objects those are is not the same
 * as what the measurement was taken from: the length of a segment reads as the
 * letters of the two points it runs between, and never as the segment's own
 * name, so those points are the ones to label.
 */
describe("what a reading spells out", () => {
  const a = createPoint({ x: 0, y: 0 }, "medium");
  const b = createPoint({ x: 100, y: 0 }, "medium");
  const seg = createLine("segment", { kind: "through", ends: [a.id, b.id] });

  function spelled(measurement: SketchObject, objects: SketchObject[]): string[] {
    const names = new Map<string, string>();
    return spelledOutBy(measurement as never, { objects, names });
  }

  it("names the points a length runs between, not the segment", () => {
    const length = createMeasurement("length", [seg.id], { x: 0, y: 40 });
    const spells = spelled(length, [a, b, seg, length]);
    expect(spells).toContain(a.id);
    expect(spells).toContain(b.id);
    expect(spells).not.toContain(seg.id);
  });

  it("names all three points of an angle", () => {
    const corner = createPoint({ x: 50, y: 80 }, "medium");
    const angle = createMeasurement("angle", [a.id, corner.id, b.id], { x: 0, y: 40 });
    const spells = spelled(angle, [a, b, corner, angle]);
    expect(spells).toEqual(expect.arrayContaining([a.id, corner.id, b.id]));
  });
});
