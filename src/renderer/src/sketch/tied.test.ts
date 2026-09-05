// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SketchObject } from "./model";
import { createLine, createMeasurement, createPoint, settle } from "./model";
import { readingsPlaced } from "./tied";

/**
 * A tied reading following its figure. The number's place on the sheet is
 * worked out from the figure every time the page settles, so what reads it
 * later sees a plain spot and knows nothing about the tie.
 */
describe("placing a tied reading", () => {
  /** The page settled and its readings placed, which is what a change commits. */
  function placed(objects: SketchObject[]): SketchObject[] {
    const page = settle(objects);
    return readingsPlaced(page.objects, page.settled);
  }

  function spotOf(objects: SketchObject[], id: string) {
    const found = objects.find((object) => object.id === id);
    return found && "x" in found ? { x: found.x, y: found.y } : null;
  }

  const a = createPoint({ x: 0, y: 0 }, "medium");
  const b = createPoint({ x: 100, y: 0 }, "medium");
  const seg = createLine("segment", { kind: "through", ends: [a.id, b.id] });
  /** Over the middle of the segment and 20 clear of it. */
  const over = { along: 0, across: 20 };

  it("leaves a reading that is not tied where it was put", () => {
    const length = createMeasurement("length", [seg.id], { x: 50, y: -20 });
    const moved = { ...b, x: 300, y: 80 };
    expect(spotOf(placed([a, moved, seg, length]), length.id)).toEqual({ x: 50, y: -20 });
  });

  it("carries a tied reading to where the figure has got to", () => {
    const length = {
      ...createMeasurement("length", [seg.id], { x: 50, y: -20 }),
      tied: over,
    };
    const moved = { ...b, x: 300, y: 0 };
    const at = spotOf(placed([a, moved, seg, length]), length.id);
    expect(at?.x).toBeCloseTo(150);
    expect(at?.y).toBeCloseTo(-20);
  });

  it("hands the page straight back where nothing has to move", () => {
    // Identity matters: every change goes through this pass, and a new array
    // every time would have the sheet redraw whatever was only looked at.
    const length = { ...createMeasurement("length", [seg.id], { x: 50, y: 0 }), tied: over };
    const page = [a, b, seg, length];
    const settled = settle(page);
    const first = readingsPlaced(settled.objects, settled.settled);
    const again = settle(first);
    expect(readingsPlaced(again.objects, again.settled)).toBe(again.objects);
  });

  it("leaves a tied reading alone where its figure has gone", () => {
    const length = {
      ...createMeasurement("length", ["gone"], { x: 50, y: -20 }),
      tied: over,
    };
    expect(spotOf(placed([length]), length.id)).toEqual({ x: 50, y: -20 });
  });
});
