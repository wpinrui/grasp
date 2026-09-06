import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createCaption, createPoint, lineThrough, type SketchObject } from "../sketch/model";
import { DEFAULT_PREFS } from "../sketch/prefs";
import { useSketch } from "../sketch/useSketch";
import { type PaletteContext, paletteState } from "./palette";

it("previews palette changes with the same result as a click, without arming tools or adding undo steps", () => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = createPoint({ x: 400, y: 100 }, "medium");
  const line = lineThrough("segment", [a.id, b.id]);
  const caption = {
    ...createCaption({ x: 100, y: 200 }, 200, {
      font: "Arial",
      size: 14,
      colour: "--color-ink-black",
    }),
    html: "Sample",
  };
  const { result } = renderHook(() => useSketch());
  act(() =>
    result.current.commit({
      objects: [a, b, line, caption],
      selection: [a.id, line.id, caption.id],
    }),
  );
  const setArmed = vi.fn();
  const context = (): PaletteContext => ({
    sketch: result.current,
    objects: result.current.state.objects,
    selected: result.current.state.objects.filter((object) =>
      result.current.state.selection.includes(object.id),
    ),
    selection: result.current.state.selection,
    editing: null,
    labelPick: [],
    prefs: DEFAULT_PREFS,
    armed: {},
    setArmed,
    activeTool: "text",
    variants: {
      arrow: "all",
      straightedge: "segment",
      polygon: "interior-edges",
      text: "caption",
      measure: "length",
      marker: "equal",
    },
  });
  const actions = [
    (show?: (objects: SketchObject[]) => void) =>
      paletteState(context()).styleSelection({ colour: "--color-ink-red" }, show),
    (show?: (objects: SketchObject[]) => void) =>
      paletteState(context()).styleSelection({ weight: "thick", pattern: "dotted" }, show),
    (show?: (objects: SketchObject[]) => void) =>
      paletteState(context()).styleWriting({ font: "Georgia", size: 28, align: "right" }, show),
    (show?: (objects: SketchObject[]) => void) =>
      paletteState(context()).styleMark("bold", true, show),
  ];
  for (const action of actions) {
    const original = result.current.read();
    const show = vi.fn();
    setArmed.mockClear();
    action(show);
    expect(show).toHaveBeenCalledOnce();
    expect(result.current.read()).toBe(original);
    expect(setArmed).not.toHaveBeenCalled();
    act(() => action());
    expect(result.current.read().objects).toEqual(show.mock.calls[0][0]);
    act(() => result.current.undo());
    expect(result.current.read().objects).toEqual(original.objects);
  }
});
