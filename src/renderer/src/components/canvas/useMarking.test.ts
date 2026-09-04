import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ANGLE_RADIUS,
  createAngleMark,
  createPoint,
  createTick,
  isMark,
  lineThrough,
  markReach,
  pathIn,
  type SketchObject,
  settle,
} from "../../sketch/model";
import { useSketch } from "../../sketch/useSketch";
import { ANGLE_ROOM } from "./sheet";
import { useMarking } from "./useMarking";

/**
 * The marking, and everything done to it. None of it is reached by the sheet's
 * own tests: every one of these is asked under the Marker or from a mark's
 * panel, and the figure the sheet lays out is drawn with the Arrow.
 */

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
const C = { ...createPoint({ x: 0, y: 100 }, "medium"), id: "C" };
const EAST = { ...lineThrough("segment", ["A", "B"]), id: "east" };
const SOUTH = { ...lineThrough("segment", ["A", "C"]), id: "south" };
const FIGURE: SketchObject[] = [A, B, C, EAST, SOUTH];

/** An angle mark at A, as wide as a mark comes out by default. */
function angleAt(id: string, reflex = false, radius = ANGLE_RADIUS) {
  return {
    ...createAngleMark({
      corner: "A",
      arms: ["B", "C"],
      sides: ["east", "south"],
      strokes: 1,
      reflex,
      radius,
    }),
    id,
  };
}

/** The hook over a real page, with the figure settled as the sheet settles it. */
function marking(objects: SketchObject[] = FIGURE, tool: "equal" | "parallel" | "angle" = "equal") {
  const sketch = renderHook(() => useSketch()).result;
  act(() => sketch.current.commit({ objects, selection: [] }));
  const settled = settle(objects).settled;
  const hook = renderHook(() =>
    useMarking({
      sketch: sketch.current,
      objects,
      settled,
      scale: 1,
      view: { x: 0, y: 0, scale: 1 },
      marking: tool,
    }),
  ).result;
  return {
    hook,
    settled,
    page: () => sketch.current.state.objects,
    at: (id: string) => sketch.current.state.objects.find((object) => object.id === id),
  };
}

describe("laying a tick on a path", () => {
  /**
   * A path says a thing once. Clicking one that already carries what this tool
   * says opens that mark's panel instead of laying a second on top of it.
   */
  it("lays one, then opens its panel rather than laying another", () => {
    const first = marking();
    const along = pathIn(first.settled, "east");
    if (!along) throw new Error("The segment did not settle.");
    act(() => first.hook.current.layTick({ path: EAST, along, spot: { x: 50, y: 0 } }));
    const laid = first.page().filter(isMark);
    expect(laid).toHaveLength(1);
    expect(first.hook.current.panel).toBe(laid[0].id);

    // The same tool over the same path again, with that tick now on the page.
    const again = marking([...FIGURE, laid[0]]);
    act(() => again.hook.current.layTick({ path: EAST, along, spot: { x: 70, y: 0 } }));
    expect(again.page().filter(isMark)).toHaveLength(1);
    expect(again.hook.current.panel).toBe(laid[0].id);
  });

  /**
   * A panel only ever opens on a mark the sheet has already drawn once, so what
   * it sets is read back off a page that has that mark on it.
   */
  it("keeps the strokes a mark's panel was left at, for the next one", () => {
    const laid = {
      ...createTick({ form: "equal", path: "east", at: 0.5, strokes: 1, flipped: false }),
      id: "tick",
    };
    const { hook, at } = marking([...FIGURE, laid]);
    act(() => hook.current.setStrokes("tick", 3));
    const kept = at("tick");
    expect(kept && isMark(kept) ? kept.strokes : null).toBe(3);
    expect(hook.current.lastMark.current.equal).toBe(3);
  });
});

/**
 * Two sets of arcs at the same radius sit on top of one another, and then the
 * second angle cannot be seen or clicked.
 */
describe("how far a new angle mark stands off its corner", () => {
  it("takes the remembered radius where the corner is bare", () => {
    const { hook } = marking(FIGURE, "angle");
    expect(hook.current.clearOfCorner("A")).toBe(hook.current.lastMark.current.radius);
  });

  it("stands clear of what is already marked there", () => {
    const there = angleAt("first");
    const { hook } = marking([...FIGURE, there], "angle");
    expect(hook.current.clearOfCorner("A")).toBe(markReach(there) + ANGLE_ROOM);
  });
});

describe("turning an angle round", () => {
  const nothingRead = () => ({}) as never;

  it("turns the mark where no other mark claims the other way round", () => {
    const { hook, at } = marking([...FIGURE, angleAt("one")], "angle");
    act(() => hook.current.flipReflex("one", nothingRead()));
    const turned = at("one");
    expect(turned && isMark(turned) && !("path" in turned) ? turned.reflex : null).toBe(true);
  });

  /**
   * One angle is marked once, so turning this one round would make it the mark
   * the other side of these arms already is.
   */
  it("refuses where the mark it would become is already there", () => {
    const both = [...FIGURE, angleAt("one"), angleAt("other", true)];
    const { hook, at } = marking(both, "angle");
    act(() => hook.current.flipReflex("one", nothingRead()));
    const left = at("one");
    expect(left && isMark(left) && !("path" in left) ? left.reflex : null).toBe(false);
  });
});

describe("what the panel is offered", () => {
  it("offers the swap only where the other kind is not on that path already", () => {
    const { hook, settled, page } = marking();
    const along = pathIn(settled, "east");
    if (!along) throw new Error("The segment did not settle.");
    act(() => hook.current.layTick({ path: EAST, along, spot: { x: 50, y: 0 } }));
    const equal = page().filter(isMark)[0];
    expect(hook.current.canSwap(equal)).toBe(true);

    const other = {
      ...createTick({ form: "parallel", path: "east", at: 0.5, strokes: 1, flipped: false }),
      id: "other",
    };
    const both = marking([...FIGURE, equal, other]);
    expect(both.hook.current.canSwap(equal)).toBe(false);
  });

  it("takes a mark off the sheet and closes the panel with it", () => {
    const { hook, settled, page } = marking();
    const along = pathIn(settled, "east");
    if (!along) throw new Error("The segment did not settle.");
    act(() => hook.current.layTick({ path: EAST, along, spot: { x: 50, y: 0 } }));
    const laid = page().filter(isMark)[0];
    act(() => hook.current.dropMark(laid.id));
    expect(page().filter(isMark)).toHaveLength(0);
    expect(hook.current.panel).toBe(null);
  });
});
