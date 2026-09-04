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
  const shown = renderHook(
    (props: { armed: boolean; page: string }) =>
      useRegular({ sketch, pointSize: "medium", ...props }),
    { initialProps: { armed: true, page: "one" } },
  );
  return { ...shown, committed };
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
    expect(committed[0].objects.filter(isPoint)).toHaveLength(4);
    expect(committed[0].objects.filter(isInterior)).toHaveLength(1);
  });

  it("commits nothing for a count no polygon has", () => {
    const { result, committed } = held();
    act(() => result.current.ask(SPOT));
    act(() => result.current.draw({ sides: 2, locked: false }));
    // Nothing changed, so there is no step to undo either.
    expect(committed).toEqual([]);
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
