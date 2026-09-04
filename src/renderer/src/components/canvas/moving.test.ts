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
  settle,
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

/** A free point, and a segment from the point on the first one out to it. */
const Q = { ...createPoint({ x: 150, y: 200 }, "medium"), id: "Q" };
const HANGING = { ...lineThrough("segment", ["P", "Q"]), id: "hang" };

/** A point halfway along that second segment, so it is two paths deep. */
const ON_HANGING = {
  ...createPoint({ x: 150, y: 100 }, "medium", { kind: "on", path: "hang", at: 0.5 }),
  id: "R",
};

const DEEPER: SketchObject[] = [A, B, SEGMENT, ON, Q, HANGING, ON_HANGING];

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

  /**
   * A point on a path rides the path when the path is dragged too, so it must
   * not be slid along it as well or the drag counts twice over.
   */
  it("leaves a point alone where the path it is on is dragged with it", () => {
    const moved = placedBy(FIGURE, holding(["seg", "P"]), { x: 60, y: 0 }).find(
      (object) => object.id === "P",
    );
    if (!moved || !isPoint(moved)) throw new Error("P is still on the sheet.");
    expect(moved.from?.kind === "on" ? moved.from.at : null).toBe(0.5);
  });

  /** The whole thing travels together: the point stays where it was on the path. */
  it("carries a point on a path the same distance as the path itself", () => {
    const sketch = page(["seg", "P"]);
    const held = pressOn(sketch, "seg");
    if (!held) throw new Error("the segment can move.");
    act(() => moveBy(held, { x: 60, y: 0 }, sketch.current));
    expect(spot(sketch.current.state.objects, "A")).toEqual({ x: 60, y: 0 });
    expect(spot(sketch.current.state.objects, "P")).toEqual({ x: 210, y: 0 });
  });
});

/** Where everything has got to once the page has worked itself out. */
function spots(objects: SketchObject[]) {
  return settle(objects).settled.points;
}

/** What a drag on those objects has hold of, two paths deep. */
function deeperHold(carried: string[]) {
  const held = whatMoves(carried, DEEPER);
  if (!held) throw new Error(`${carried.join(", ")} can move.`);
  return held;
}

describe("where a drag pulls a path", () => {
  /**
   * P is on the first segment and R is on the segment hanging off P. Dragging
   * both moves the segment under R, so R keeps how far along it sits and Q, the
   * end of that segment nothing else is holding, goes wherever that needs.
   */
  it("moves the loose end of a path so the point dragged on it follows the pointer", () => {
    const moved = spots(placedBy(DEEPER, deeperHold(["P", "R"]), { x: 60, y: 60 }));
    expect(moved.get("R")).toMatchObject({ x: 210, y: 160 });
    expect(moved.get("Q")).toMatchObject({ x: 210, y: 320 });
  });

  /** P slides along its own segment, which stays where it is throughout. */
  it("leaves the path that is not moving, and the point on it slides", () => {
    const moved = spots(placedBy(DEEPER, deeperHold(["P", "R"]), { x: 60, y: 60 }));
    expect(moved.get("P")).toMatchObject({ x: 210, y: 0 });
    expect(moved.get("A")).toMatchObject({ x: 0, y: 0 });
    expect(moved.get("B")).toMatchObject({ x: 300, y: 0 });
  });

  /** How far along it sits is the thing that holds while the path swings. */
  it("keeps how far along the pulled point sits", () => {
    const moved = placedBy(DEEPER, deeperHold(["P", "R"]), { x: 60, y: 60 }).find(
      (object) => object.id === "R",
    );
    if (!moved || !isPoint(moved)) throw new Error("R is still on the sheet.");
    expect(moved.from?.kind === "on" ? moved.from.at : null).toBe(0.5);
  });

  /**
   * The same, with the segment drawn the other way about, so the end that has
   * to give is the one how far along is counted from.
   */
  it("moves whichever end of the path the drag is not already holding", () => {
    const backwards = { ...lineThrough("segment", ["Q", "P"]), id: "hang" };
    const near = {
      ...createPoint({ x: 150, y: 150 }, "medium", { kind: "on", path: "hang", at: 0.25 }),
      id: "R",
    };
    const figure: SketchObject[] = [A, B, SEGMENT, ON, Q, backwards, near];
    const held = whatMoves(["P", "R"], figure);
    if (!held) throw new Error("P and R can move.");
    const moved = spots(placedBy(figure, held, { x: 60, y: 60 }));
    expect(moved.get("R")).toMatchObject({ x: 210, y: 210 });
    expect(moved.get("Q")).toMatchObject({ x: 210, y: 280 });
  });

  /**
   * Dragged on its own, a point on a path still only slides along it. Nothing
   * else in the drag moves that path, so nothing has to give for it.
   */
  it("slides a point dragged on its own, and leaves the path alone", () => {
    const moved = spots(placedBy(DEEPER, deeperHold(["R"]), { x: 60, y: 60 }));
    expect(moved.get("R")).toMatchObject({ x: 150, y: 160 });
    expect(moved.get("Q")).toMatchObject({ x: 150, y: 200 });
  });
});
