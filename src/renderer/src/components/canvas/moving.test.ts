/**
 * What a drag has hold of, and where that puts things. The sheet's own tests
 * drag nothing, so none of this is reached by them.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createCaption,
  createPoint,
  isPoint,
  lineThrough,
  type SketchObject,
} from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";
import { useSketch } from "../../sketch/useSketch";
import { type Held, moveBy, placedBy, takeHold, whatMoves } from "./moving";

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 300, y: 0 }, "medium"), id: "B" };
const SEGMENT = { ...lineThrough("segment", ["A", "B"]), id: "seg" };

/** A point put on the segment, halfway along it. */
const ON = {
  ...createPoint({ x: 150, y: 0 }, "medium", { kind: "on", path: "seg", at: 0.5 }),
  id: "P",
};

const LOOK = { font: "Times New Roman", size: 14, colour: "--color-ink-black" };

/** A caption that names A, so it hangs off A without being held up by it. */
const CAPTION = {
  ...createCaption({ x: 40, y: 40 }, 220, LOOK),
  id: "cap",
  html: 'Through <span data-link="A">A</span>',
};

const FIGURE: SketchObject[] = [A, B, SEGMENT, ON, CAPTION];

/** Where an object has got to, by id. */
function spot(objects: SketchObject[], id: string) {
  const found = objects.find((object) => object.id === id);
  return found && "x" in found ? { x: found.x, y: found.y } : null;
}

describe("what a drag has hold of", () => {
  /** A line has no place of its own, so dragging one carries its two ends. */
  it("carries the ends of a line, not the line", () => {
    const held = whatMoves(["seg"], FIGURE);
    expect(held?.ids).toEqual(["A", "B"]);
    expect(held?.from).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]);
  });

  /** A point on a path is dragged in its own right: it slides, it is not carried. */
  it("carries a point on a path itself, not the path it is on", () => {
    expect(whatMoves(["P"], FIGURE)?.ids).toEqual(["P"]);
  });

  /**
   * Writing travels on its own. A caption naming a point does not drag the
   * point about with it, or writing about a figure could not be moved off it.
   */
  it("carries writing alone, leaving what it names where it is", () => {
    const held = whatMoves(["cap"], FIGURE);
    expect(held?.ids).toEqual(["cap"]);
    expect(held?.from).toEqual([{ x: 40, y: 40 }]);
  });

  it("has hold of nothing where there is nothing to move", () => {
    expect(whatMoves([], FIGURE)).toBe(null);
    expect(whatMoves(["gone"], FIGURE)).toBe(null);
  });
});

/** The hook over a real page, selected as the sheet would have left it. */
function page(selection: string[]) {
  const sketch = renderHook(() => useSketch()).result;
  act(() => sketch.current.commit({ objects: FIGURE, selection }));
  return sketch;
}

/** A press on that object, taken as the sheet takes it, with the page rendered. */
function pressOn(sketch: { current: Sketch }, hitId: string): Held | null {
  let held: Held | null = null;
  act(() => {
    held = takeHold(hitId, sketch.current);
  });
  return held;
}

describe("taking hold", () => {
  it("carries the whole selection where the press was on part of it", () => {
    const sketch = page(["seg", "cap"]);
    expect(pressOn(sketch, "seg")?.ids).toEqual(["A", "B", "cap"]);
    expect(sketch.current.state.selection).toEqual(["seg", "cap"]);
  });

  it("takes the selection over where the press was outside it", () => {
    const sketch = page(["cap"]);
    expect(pressOn(sketch, "seg")?.ids).toEqual(["A", "B"]);
    expect(sketch.current.state.selection).toEqual(["seg"]);
  });

  /**
   * Nothing to move means no gesture either. One left open would swallow
   * whatever came next, so cancelling it would take that back as well.
   */
  it("takes hold of nothing, and starts nothing, where nothing can move", () => {
    const sketch = page([]);
    expect(pressOn(sketch, "gone")).toBe(null);
    expect(sketch.current.state.selection).toEqual([]);
    act(() => {
      sketch.current.select(["A"]);
      sketch.current.cancelGesture();
    });
    expect(sketch.current.state.selection).toEqual(["A"]);
  });
});

/** What a drag on those objects has hold of, which is what puts anything anywhere. */
function holding(carried: string[]) {
  const held = whatMoves(carried, FIGURE);
  if (!held) throw new Error(`${carried.join(", ")} can move.`);
  return held;
}

describe("where a drag puts things", () => {
  /**
   * Each point goes as far as the pointer came, counted from where that point
   * started rather than from the pointer, so the figure keeps its shape.
   */
  it("moves every point it holds by the same amount, from where each began", () => {
    const moved = placedBy(FIGURE, holding(["seg"]), { x: 10, y: 20 });
    expect(spot(moved, "A")).toEqual({ x: 10, y: 20 });
    expect(spot(moved, "B")).toEqual({ x: 310, y: 20 });
  });

  it("leaves alone what the drag has no hold of", () => {
    const moved = placedBy(FIGURE, holding(["A"]), { x: 10, y: 20 });
    expect(spot(moved, "B")).toEqual({ x: 300, y: 0 });
  });

  /**
   * A point on a path is not free to go where the pointer went. It stays on the
   * path and slides to where the pointer is nearest it, which is how far along
   * it now sits rather than a place of its own.
   */
  it("slides a point on a path along it rather than off it", () => {
    const moved = placedBy(FIGURE, holding(["P"]), { x: 60, y: 40 }).find(
      (object) => object.id === "P",
    );
    if (!moved || !isPoint(moved)) throw new Error("P is still on the sheet.");
    expect(moved.from?.kind === "on" ? moved.from.at : null).toBeCloseTo(0.7, 10);
    // Its own x and y are stale until the figure settles: how far along it is
    // is what it holds, and where that puts it is worked out from the path.
    expect({ x: moved.x, y: moved.y }).toEqual({ x: 150, y: 0 });
  });

  /** What the slide comes to once the page has settled, which is what is seen. */
  it("leaves the slid point on the path, at where it slid to", () => {
    const sketch = page([]);
    const held = pressOn(sketch, "P");
    if (!held) throw new Error("P is a point and can move.");
    act(() => moveBy(held, { x: 60, y: 40 }, sketch.current));
    expect(spot(sketch.current.state.objects, "P")).toEqual({ x: 210, y: 0 });
  });
});
