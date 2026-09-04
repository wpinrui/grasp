// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SketchObject } from "../model";
import { createLine, createMeasurement, createPoint, namesFor, settle } from "../model";
import { readingOf, readingText, spelledOutBy } from "./reading";

/**
 * Taking a measurement names whatever its reading spells out, so a new reading
 * never comes out saying "?? = 5 cm". Which objects those are is not the same
 * as what the measurement was taken from: the length of a segment reads as the
 * letters of the two points it runs between, and never as the segment's own
 * name, so those points are the ones to name.
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

  it("prints the letters of points whose labels are put away", () => {
    // The whole reason a measurement names what it reads: the letters go into
    // the reading whether or not either label is beside its point.
    const named = (one: SketchObject, name: string): SketchObject => ({
      ...one,
      label: { name, shown: false },
    });
    const length = createMeasurement("length", [seg.id], { x: 0, y: 40 });
    const objects = [named(a, "A"), named(b, "B"), seg, length];
    const reading = readingOf(length, {
      objects,
      names: namesFor(objects),
      settled: settle(objects).settled,
    });
    expect(readingText(reading)).toContain("AB");
  });

  it("names all three points of an angle", () => {
    const corner = createPoint({ x: 50, y: 80 }, "medium");
    const angle = createMeasurement("angle", [a.id, corner.id, b.id], { x: 0, y: 40 });
    const spells = spelled(angle, [a, b, corner, angle]);
    expect(spells).toEqual(expect.arrayContaining([a.id, corner.id, b.id]));
  });
});
