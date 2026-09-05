/**
 * Dragging a reading tied to its figure. A tied number holds where it hangs off
 * the figure rather than where it sits on the sheet, so a drag has to set the
 * one rather than the other, and it has to read the drop in the frame the
 * figure ends up in rather than the one it started in.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createMeasurement,
  createPoint,
  isMeasurement,
  lineThrough,
  type SketchObject,
} from "../../sketch/model";
import { type Sketch, useSketch } from "../../sketch/useSketch";
import { type Held, moveBy, placedBy, takeHold, whatMoves } from "./moving";

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 300, y: 0 }, "medium"), id: "B" };
const SEGMENT = { ...lineThrough("segment", ["A", "B"]), id: "seg" };

/** A length tied over the middle of the segment and 20 clear of it. */
const TIED = {
  ...createMeasurement("length", ["seg"], { x: 150, y: -20 }),
  id: "len",
  bare: true,
  tied: { along: 0, across: 20 },
};

const MEASURED: SketchObject[] = [A, B, SEGMENT, TIED];

/** Where an object has got to, by id. */
function spot(objects: SketchObject[], id: string) {
  const found = objects.find((object) => object.id === id);
  return found && "x" in found ? { x: found.x, y: found.y } : null;
}

function heldIn(carried: string[]): Held {
  const held = whatMoves(carried, MEASURED);
  if (!held) throw new Error(`${carried.join(", ")} can move.`);
  return held;
}

/** How the number hangs off its figure, which is what a drag on it sets. */
function tieOf(objects: SketchObject[]) {
  const found = objects.find((object) => object.id === "len");
  return found && isMeasurement(found) ? found.tied : undefined;
}

/** The figure on a page, with that selection, ready to be pressed on. */
function page(selection: string[]) {
  const sketch = renderHook(() => useSketch()).result;
  act(() => sketch.current.commit({ objects: MEASURED, selection }));
  return sketch;
}

/** A press on that object, taken as the sheet takes it. */
function pressOn(sketch: { current: Sketch }, hitId: string): Held {
  let held: Held | null = null;
  act(() => {
    held = takeHold(hitId, sketch.current);
  });
  if (!held) throw new Error(`${hitId} can move.`);
  return held;
}

describe("dragging a reading tied to its figure", () => {
  it("hangs a dragged number off the figure where it was dropped", () => {
    const moved = placedBy(MEASURED, heldIn(["len"]), { x: 0, y: -30 });
    // Dropped 50 clear of the segment rather than 20, and still over its
    // middle, which is where the pointer left it.
    expect(tieOf(moved)?.across).toBeCloseTo(50);
    expect(tieOf(moved)?.along).toBeCloseTo(0);
    expect(spot(moved, "len")).toEqual({ x: 150, y: -50 });
  });

  it("leaves the number where it was dropped once the page has settled", () => {
    const sketch = page([]);
    act(() => moveBy(pressOn(sketch, "len"), { x: 0, y: -30 }, sketch.current));
    expect(spot(sketch.current.state.objects, "len")).toEqual({ x: 150, y: -50 });
  });

  it("leaves the tie alone where the whole figure is dragged with it", () => {
    // The segment is moving too, so the frame the drop is read in has moved
    // with it and the number comes out hanging exactly where it hung before.
    // Read in the frame the drag started from, it would count the drag twice.
    const moved = placedBy(MEASURED, heldIn(["seg", "len"]), { x: 0, y: -30 });
    expect(tieOf(moved)?.across).toBeCloseTo(20);
    expect(tieOf(moved)?.along).toBeCloseTo(0);
  });

  it("carries the number exactly as far as the figure it is tied to", () => {
    const sketch = page(["seg", "len"]);
    act(() => moveBy(pressOn(sketch, "seg"), { x: 0, y: -30 }, sketch.current));
    expect(spot(sketch.current.state.objects, "len")).toEqual({ x: 150, y: -50 });
  });

  it("counts a drag once where only one end of the figure moves with it", () => {
    // B alone is dragged, so the middle of the segment comes down half as far
    // as the pointer does. The number still has to land under the pointer
    // rather than drift by whatever the middle did.
    const sketch = page(["B", "len"]);
    act(() => moveBy(pressOn(sketch, "B"), { x: 0, y: -40 }, sketch.current));
    const at = spot(sketch.current.state.objects, "len");
    expect(at?.x).toBeCloseTo(150);
    expect(at?.y).toBeCloseTo(-60);
  });

  it("leaves a number that is not tied to be moved as writing always was", () => {
    const loose = { ...TIED, tied: undefined };
    const objects = [A, B, SEGMENT, loose];
    const held = whatMoves(["len"], objects);
    if (!held) throw new Error("a reading can move.");
    const moved = placedBy(objects, held, { x: 0, y: -30 });
    expect(spot(moved, "len")).toEqual({ x: 150, y: -50 });
    expect(tieOf(moved)).toBeUndefined();
  });
});
