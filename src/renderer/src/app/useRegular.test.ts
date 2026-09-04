import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isInterior, isPoint, type SketchState } from "../sketch/model";
import type { Sketch } from "../sketch/useSketch";
import { useRegular } from "./useRegular";

/** Only the two calls a pending ask makes of the page, so the rest is left out. */
function stubSketch(page: SketchState) {
  const committed: SketchState[] = [];
  const sketch = {
    read: () => page,
    commit: (next: SketchState) => committed.push(next),
  } as unknown as Sketch;
  return { sketch, committed };
}

const SPOT = { spot: { x: 200, y: 200 }, at: { x: 40, y: 40 } };

function held(page: SketchState = { objects: [], selection: [] }) {
  const { sketch, committed } = stubSketch(page);
  const drawn: true[] = [];
  const shown = renderHook(
    (props: { armed: boolean; page: string }) =>
      useRegular({ sketch, pointSize: "medium", onDrawn: () => drawn.push(true), ...props }),
    { initialProps: { armed: true, page: "one" } },
  );
  return { ...shown, committed, drawn };
}

/**
 * The ask belongs to the arming that made it and to the page it was made on.
 * Answering it after either has moved would build inside whatever is going on
 * by then, so it is dropped instead.
 */
describe("a regular polygon waiting to be drawn", () => {
  it("keeps the spot of the first click while the box is up", () => {
    const { result } = held();
    act(() => result.current.ask(SPOT));
    act(() => result.current.ask({ spot: { x: 9, y: 9 }, at: { x: 9, y: 9 } }));
    expect(result.current.asked).toEqual(SPOT);
  });

  it("draws the shape where the click was, and lets the ask go", () => {
    const { result, committed } = held();
    act(() => result.current.ask(SPOT));
    act(() => result.current.draw({ sides: 4, locked: false }));
    expect(result.current.asked).toBeNull();
    expect(committed).toHaveLength(1);
    const corners = committed[0].objects.filter(isPoint);
    expect(corners).toHaveLength(4);
    expect(committed[0].objects.filter(isInterior)).toHaveLength(1);
    // Built about the spot on the sheet, not the screen point the box stood at:
    // the two are different coordinate spaces and only one is where to build.
    // A regular polygon's corners average to its middle, so that is the check.
    const middle = corners.reduce(
      (sum, corner) => ({ x: sum.x + corner.x / 4, y: sum.y + corner.y / 4 }),
      { x: 0, y: 0 },
    );
    expect(middle.x).toBeCloseTo(SPOT.spot.x, 6);
    expect(middle.y).toBeCloseTo(SPOT.spot.y, 6);
  });

  it("hands the sheet back once the shape is drawn", () => {
    // It lands picked with nothing left to click out, so the Arrow is next.
    const { result, drawn } = held();
    act(() => result.current.ask(SPOT));
    expect(drawn).toEqual([]);
    act(() => result.current.draw({ sides: 6, locked: true }));
    expect(drawn).toEqual([true]);
  });

  it("commits nothing for a count no polygon has", () => {
    const { result, committed, drawn } = held();
    act(() => result.current.ask(SPOT));
    act(() => result.current.draw({ sides: 2, locked: false }));
    // Nothing changed, so there is no step to undo and no sheet to hand back.
    expect(committed).toEqual([]);
    expect(drawn).toEqual([]);
    expect(result.current.asked).toBeNull();
  });

  it("lets the ask go when the box is dismissed", () => {
    const { result } = held();
    act(() => result.current.ask(SPOT));
    act(() => result.current.drop());
    expect(result.current.asked).toBeNull();
  });

  it("lets the ask go when the polygon is armed some other way", () => {
    const { result, rerender } = held();
    act(() => result.current.ask(SPOT));
    rerender({ armed: false, page: "one" });
    expect(result.current.asked).toBeNull();
  });

  it("lets the ask go when another page is turned to", () => {
    const { result, rerender } = held();
    act(() => result.current.ask(SPOT));
    rerender({ armed: true, page: "two" });
    expect(result.current.asked).toBeNull();
  });

  it("draws nothing at all when there was no ask to answer", () => {
    const { result, committed } = held();
    act(() => result.current.draw({ sides: 5, locked: true }));
    expect(committed).toEqual([]);
  });
});
