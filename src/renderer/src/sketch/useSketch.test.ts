import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createPoint, isPoint, type Position, type SketchObject } from "./model";
import { useSketch } from "./useSketch";

const point = (at: Position) => createPoint(at, "medium");

/** The page as ids, which is what an undo step is judged by. */
function ids(objects: SketchObject[]): string[] {
  return objects.map((object) => object.id);
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
