import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createLine,
  createMeasurement,
  createPoint,
  isPoint,
  type Position,
  type SketchObject,
} from "./model";
import { useSketch } from "./useSketch";

const point = (at: Position) => createPoint(at, "medium");

/** The page as ids, which is what an undo step is judged by. */
function ids(objects: SketchObject[]): string[] {
  return objects.map((object) => object.id);
}

/** What one object is called, which is only ever what is written on its label. */
function called(objects: SketchObject[], id: string): string | undefined {
  return objects.find((object) => object.id === id)?.label?.name;
}

/** Whether one object's label is showing. */
function showing(objects: SketchObject[], id: string): boolean {
  return objects.find((object) => object.id === id)?.label?.shown === true;
}

/** The same page with one object's label shown or hidden, as a commit would leave it. */
function labelled(objects: SketchObject[], id: string, shown: boolean): SketchObject[] {
  return objects.map((object) =>
    object.id === id ? { ...object, label: { ...object.label, shown } } : object,
  );
}

function sized(objects: SketchObject[], id: string): string | undefined {
  const found = objects.find((object) => object.id === id);
  return found && isPoint(found) ? found.size : undefined;
}

describe("undo and redo", () => {
  it("puts back what was there, and puts it forward again", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 50, y: 0 });

    act(() => result.current.commit({ objects: [a], selection: [] }));
    act(() => result.current.commit({ objects: [a, b], selection: [] }));
    expect(ids(result.current.state.objects)).toEqual([a.id, b.id]);

    act(() => result.current.undo());
    expect(ids(result.current.state.objects)).toEqual([a.id]);

    act(() => result.current.undo());
    expect(ids(result.current.state.objects)).toEqual([]);

    act(() => result.current.redo());
    expect(ids(result.current.state.objects)).toEqual([a.id]);

    act(() => result.current.redo());
    expect(ids(result.current.state.objects)).toEqual([a.id, b.id]);
  });

  it("does nothing at either end of the history", () => {
    const { result } = renderHook(() => useSketch());
    act(() => result.current.undo());
    expect(result.current.state.objects).toEqual([]);
    act(() => result.current.redo());
    expect(result.current.state.objects).toEqual([]);
  });

  it("drops what was undone as soon as something else is committed", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 50, y: 0 });
    const other = point({ x: 90, y: 90 });

    act(() => result.current.commit({ objects: [a], selection: [] }));
    act(() => result.current.commit({ objects: [a, b], selection: [] }));
    act(() => result.current.undo());
    act(() => result.current.commit({ objects: [a, other], selection: [] }));
    act(() => result.current.redo());

    // Redo must not bring `b` back: committing over an undo throws the redo away.
    expect(ids(result.current.state.objects)).toEqual([a.id, other.id]);
  });
});

describe("a gesture", () => {
  it("collapses into one undo step however many times it updated", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));

    act(() => result.current.beginGesture());
    for (const x of [10, 20, 30]) {
      act(() => result.current.updateGesture({ objects: [{ ...a, x }], selection: [] }));
    }
    act(() => result.current.endGesture());

    expect(result.current.state.objects[0]).toMatchObject({ id: a.id, x: 30 });
    act(() => result.current.undo());
    expect(result.current.state.objects[0]).toMatchObject({ id: a.id, x: 0 });
  });

  it("puts back what it found when it is cancelled, and records nothing", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));

    act(() => result.current.beginGesture());
    act(() => result.current.updateGesture({ objects: [{ ...a, x: 40 }], selection: [] }));
    act(() => result.current.cancelGesture());
    expect(result.current.state.objects[0]).toMatchObject({ id: a.id, x: 0 });

    // Nothing was recorded, so undo reaches past the gesture to the commit.
    act(() => result.current.undo());
    expect(result.current.state.objects).toEqual([]);
  });
});

describe("resizing a point", () => {
  it("resizes the history too, so undoing a move keeps the new size", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));
    act(() => result.current.commit({ objects: [{ ...a, x: 60 }], selection: [] }));
    act(() => result.current.select([a.id]));
    act(() => result.current.restyle("large"));
    expect(sized(result.current.state.objects, a.id)).toBe("large");

    act(() => result.current.undo());
    expect(result.current.state.objects[0]).toMatchObject({ id: a.id, x: 0 });
    expect(sized(result.current.state.objects, a.id)).toBe("large");
  });

  it("resizes what was undone too, so redoing keeps the new size", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));
    act(() => result.current.commit({ objects: [{ ...a, x: 60 }], selection: [] }));
    act(() => result.current.undo());
    act(() => result.current.select([a.id]));
    act(() => result.current.restyle("large"));

    act(() => result.current.redo());
    expect(result.current.state.objects[0]).toMatchObject({ id: a.id, x: 60 });
    expect(sized(result.current.state.objects, a.id)).toBe("large");
  });

  it("is not an undo step of its own", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));
    act(() => result.current.select([a.id]));
    act(() => result.current.restyle("large"));

    act(() => result.current.undo());
    expect(result.current.state.objects).toEqual([]);
  });
});

describe("a page's history", () => {
  it("is parked rather than lost when another page is shown", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const first = result.current.activeId;
    act(() => result.current.commit({ objects: [a], selection: [] }));

    act(() => result.current.addPage());
    const second = result.current.activeId;
    expect(second).not.toBe(first);
    // The new page has a history of its own, which is empty.
    act(() => result.current.undo());
    expect(result.current.state.objects).toEqual([]);

    act(() => result.current.selectPage(first));
    expect(ids(result.current.state.objects)).toEqual([a.id]);
    act(() => result.current.undo());
    expect(result.current.state.objects).toEqual([]);
    act(() => result.current.redo());
    expect(ids(result.current.state.objects)).toEqual([a.id]);
    expect(result.current.activeId).toBe(first);
  });

  it("goes with the page, and the pages beside it keep theirs", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 90, y: 90 });
    const first = result.current.activeId;
    act(() => result.current.commit({ objects: [a], selection: [] }));

    act(() => result.current.addPage());
    act(() => result.current.commit({ objects: [b], selection: [] }));
    act(() => result.current.removePage(first));

    expect(result.current.pages.map((page) => page.id)).not.toContain(first);
    // The page that is left is the one that was added, with its own step to undo.
    expect(ids(result.current.state.objects)).toEqual([b.id]);
    act(() => result.current.undo());
    expect(result.current.state.objects).toEqual([]);
  });

  it("cannot lose the last page", () => {
    const { result } = renderHook(() => useSketch());
    act(() => result.current.removePage(result.current.activeId));
    expect(result.current.pages).toHaveLength(1);
  });
});

describe("opening a sketch from disk", () => {
  it("replaces the pages", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));

    const b = point({ x: 200, y: 200 });
    act(() => result.current.load([{ name: "Read In", objects: [b] }]));
    expect(result.current.pages.map((page) => page.name)).toEqual(["Read In"]);
    expect(ids(result.current.state.objects)).toEqual([b.id]);

    act(() => result.current.undo());
    expect(ids(result.current.state.objects)).toEqual([b.id]);
  });

  it("drops a gesture that was half done, so cancelling cannot undo the open", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));
    act(() => result.current.beginGesture());

    const b = point({ x: 200, y: 200 });
    act(() => result.current.load([{ name: "Read In", objects: [b] }]));
    act(() => result.current.cancelGesture());
    expect(ids(result.current.state.objects)).toEqual([b.id]);
  });

  it("reads as saved until something changes", () => {
    const { result } = renderHook(() => useSketch());
    const b = point({ x: 200, y: 200 });
    act(() => result.current.load([{ name: "Read In", objects: [b] }]));
    expect(result.current.dirty).toBe(false);

    act(() => result.current.commit({ objects: [], selection: [] }));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.markSaved());
    expect(result.current.dirty).toBe(false);
  });
});

describe("whether there is anything to undo", () => {
  it("has nothing either way on a fresh sketch", () => {
    const { result } = renderHook(() => useSketch());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("has something to undo once something has been drawn", () => {
    const { result } = renderHook(() => useSketch());
    act(() => result.current.commit({ objects: [point({ x: 0, y: 0 })], selection: [] }));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("swaps ends as the sketch is walked back and forward", () => {
    const { result } = renderHook(() => useSketch());
    act(() => result.current.commit({ objects: [point({ x: 0, y: 0 })], selection: [] }));

    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("has nothing to redo once something new is drawn over it", () => {
    const { result } = renderHook(() => useSketch());
    act(() => result.current.commit({ objects: [point({ x: 0, y: 0 })], selection: [] }));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.commit({ objects: [point({ x: 90, y: 0 })], selection: [] }));
    expect(result.current.canRedo).toBe(false);
  });

  it("answers for the page that is up, not for the sketch", () => {
    // Each page keeps its own history, so undo on a fresh page must not offer
    // to put back something drawn on the one before it.
    const { result } = renderHook(() => useSketch());
    act(() => result.current.commit({ objects: [point({ x: 0, y: 0 })], selection: [] }));
    const first = result.current.pages[0].id;
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.addPage());
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.selectPage(first));
    expect(result.current.canUndo).toBe(true);
  });
});

/**
 * Where a name comes from. Nothing carries one until one is wanted, and it is
 * written down when it is, so the letters of a figure never move afterwards.
 * Two things want one: a label being shown, and a reading having to spell a
 * letter out. Both go through `commit`, which is why this is asserted here
 * rather than at each of the routes into it.
 */
describe("naming what needs a name", () => {
  it("leaves what has no label with no name", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 50, y: 0 });
    act(() => result.current.commit({ objects: [a, b], selection: [] }));
    expect(called(result.current.state.objects, a.id)).toBeUndefined();
    expect(called(result.current.state.objects, b.id)).toBeUndefined();
  });

  it("names a label the moment it is shown, from the start of the run", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 50, y: 0 });
    act(() => result.current.commit({ objects: [a, b], selection: [] }));
    // The second point, and only the second: the first took no letter by being
    // drawn, so what is labelled is A rather than B.
    act(() =>
      result.current.commit({
        objects: labelled(result.current.state.objects, b.id, true),
        selection: [],
      }),
    );
    expect(called(result.current.state.objects, b.id)).toBe("A");
    expect(called(result.current.state.objects, a.id)).toBeUndefined();
  });

  it("keeps the name when the label is hidden again", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));
    act(() =>
      result.current.commit({
        objects: labelled(result.current.state.objects, a.id, true),
        selection: [],
      }),
    );
    act(() =>
      result.current.commit({
        objects: labelled(result.current.state.objects, a.id, false),
        selection: [],
      }),
    );
    expect(called(result.current.state.objects, a.id)).toBe("A");
  });

  it("labels a new point straight away where the panel has asked for it", () => {
    const { result } = renderHook(() => useSketch());
    act(() => result.current.labelNewPoints(true));
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));
    expect(showing(result.current.state.objects, a.id)).toBe(true);
    expect(called(result.current.state.objects, a.id)).toBe("A");
  });

  it("names the points a new measurement reads out, without showing them", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 50, y: 0 });
    const seg = createLine("segment", { kind: "through", ends: [a.id, b.id] });
    act(() => result.current.commit({ objects: [a, b, seg], selection: [] }));
    expect(called(result.current.state.objects, a.id)).toBeUndefined();

    // "m AB" is what the reading writes, so A and B are what it names. The
    // segment is not named: its own letter never reaches the reading.
    const length = createMeasurement("length", [seg.id], { x: 0, y: 40 });
    act(() =>
      result.current.commit({
        objects: [...result.current.state.objects, length],
        selection: [],
      }),
    );
    expect(called(result.current.state.objects, a.id)).toBe("A");
    expect(called(result.current.state.objects, b.id)).toBe("B");
    expect(called(result.current.state.objects, seg.id)).toBeUndefined();
    // Naming is what the reading needs. What the figure shows is not the
    // measurement's to change, so neither label comes on.
    expect(showing(result.current.state.objects, a.id)).toBe(false);
    expect(showing(result.current.state.objects, b.id)).toBe(false);
  });

  it("leaves a label that was put away put away", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 50, y: 0 });
    act(() => result.current.commit({ objects: [a, b], selection: [] }));
    // A label asked for and then put away again, which is not the same as one
    // never asked for: it holds a name already, and it stays away.
    act(() =>
      result.current.commit({
        objects: labelled(result.current.state.objects, a.id, true),
        selection: [],
      }),
    );
    act(() =>
      result.current.commit({
        objects: labelled(result.current.state.objects, a.id, false),
        selection: [],
      }),
    );
    const span = createMeasurement("distance", [a.id, b.id], { x: 0, y: 40 });
    act(() =>
      result.current.commit({
        objects: [...result.current.state.objects, span],
        selection: [],
      }),
    );
    expect(called(result.current.state.objects, a.id)).toBe("A");
    expect(called(result.current.state.objects, b.id)).toBe("B");
    expect(showing(result.current.state.objects, a.id)).toBe(false);
    expect(showing(result.current.state.objects, b.id)).toBe(false);
  });

  it("leaves the labels of what it measures however they were", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 50, y: 0 });
    const seg = createLine("segment", { kind: "through", ends: [a.id, b.id] });
    act(() => result.current.commit({ objects: [a, b, seg], selection: [] }));
    // One label asked for, the other not, before anything is measured.
    act(() =>
      result.current.commit({
        objects: labelled(result.current.state.objects, a.id, true),
        selection: [],
      }),
    );
    const length = createMeasurement("length", [seg.id], { x: 0, y: 40 });
    act(() =>
      result.current.commit({
        objects: [...result.current.state.objects, length],
        selection: [],
      }),
    );
    // Each stays as it was, and A keeps the letter it already had.
    expect(showing(result.current.state.objects, a.id)).toBe(true);
    expect(showing(result.current.state.objects, b.id)).toBe(false);
    expect(called(result.current.state.objects, a.id)).toBe("A");
    expect(called(result.current.state.objects, b.id)).toBe("B");
  });

  it("hands back exactly what was there, names and all", () => {
    const { result } = renderHook(() => useSketch());
    const a = point({ x: 0, y: 0 });
    act(() => result.current.commit({ objects: [a], selection: [] }));
    act(() =>
      result.current.commit({
        objects: labelled(result.current.state.objects, a.id, true),
        selection: [],
      }),
    );
    act(() => result.current.undo());
    expect(showing(result.current.state.objects, a.id)).toBe(false);
    expect(called(result.current.state.objects, a.id)).toBeUndefined();

    act(() => result.current.redo());
    expect(called(result.current.state.objects, a.id)).toBe("A");
  });
});
