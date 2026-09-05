import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createLine,
  createMeasurement,
  createPoint,
  isMeasurement,
  type Position,
  type SketchObject,
} from "./model";
import { useSketch } from "./useSketch";

const point = (at: Position) => createPoint(at, "medium");

/**
 * What a new reading comes out as. Preferences says whether a number the
 * Measure tool writes is tied to what it reads, and it says that about new
 * readings only: where a number already on the sheet has been put is not
 * Preferences' to undo.
 */
describe("tying a new reading to its figure", () => {
  /** A figure with a segment, and a length hung above the middle of it. */
  function measured() {
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 100, y: 0 });
    const seg = createLine("segment", { kind: "through", ends: [a.id, b.id] });
    const length = {
      ...createMeasurement("length", [seg.id], { x: 50, y: -20 }),
      bare: true,
    };
    return { figure: [a, b, seg], length, b };
  }

  function tied(objects: SketchObject[], id: string) {
    const found = objects.find((object) => object.id === id);
    return found && isMeasurement(found) ? found.tied : undefined;
  }

  it("ties a number the tool has just written where Preferences asks", () => {
    const { result } = renderHook(() => useSketch());
    const { figure, length } = measured();
    act(() => result.current.tieNewReadings(true));
    act(() => result.current.commit({ objects: [...figure, length], selection: [] }));
    expect(tied(result.current.state.objects, length.id)?.across).toBeCloseTo(20);
  });

  it("leaves a new number loose where Preferences does not ask", () => {
    const { result } = renderHook(() => useSketch());
    const { figure, length } = measured();
    act(() => result.current.commit({ objects: [...figure, length], selection: [] }));
    expect(tied(result.current.state.objects, length.id)).toBeUndefined();
  });

  it("leaves a reading already on the sheet loose when it is turned on", () => {
    const { result } = renderHook(() => useSketch());
    const { figure, length, b } = measured();
    act(() => result.current.commit({ objects: [...figure, length], selection: [] }));
    act(() => result.current.tieNewReadings(true));
    // Some later change, which is when the pass would reach the old reading.
    act(() =>
      result.current.commit({
        objects: result.current.state.objects.map((object) =>
          object.id === b.id ? { ...object, x: 200 } : object,
        ),
        selection: [],
      }),
    );
    expect(tied(result.current.state.objects, length.id)).toBeUndefined();
  });

  it("does not tie anything on an undo", () => {
    const { result } = renderHook(() => useSketch());
    const { figure, length } = measured();
    act(() => result.current.commit({ objects: figure, selection: [] }));
    act(() => result.current.commit({ objects: [...figure, length], selection: [] }));
    act(() => result.current.tieNewReadings(true));
    act(() => result.current.undo());
    act(() => result.current.redo());
    // Undo and redo hand back a state that was arrived at once already, so the
    // reading comes back exactly as loose as it was written.
    expect(tied(result.current.state.objects, length.id)).toBeUndefined();
  });
});
