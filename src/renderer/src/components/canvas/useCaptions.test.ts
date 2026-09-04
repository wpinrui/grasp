/**
 * Writing a caption. None of it is reached by the sheet's own tests: every one
 * of these is asked while a caption is open to type into, and the sheet is
 * rendered with nothing open.
 */

import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { createCaption, isCaption, type SketchObject } from "../../sketch/model";
import { useSketch } from "../../sketch/useSketch";
import { useCaptions } from "./useCaptions";

const LOOK = {
  font: "Times New Roman",
  size: 14,
  colour: "--color-ink-black",
  align: "left",
} as const;

const CAPTION = { ...createCaption({ x: 40, y: 40 }, 220, LOOK), id: "cap", html: "Hello" };

/**
 * The hook over a real page, with a real field to read the text back out of and
 * a record of what it asked the window to open.
 */
function writing(objects: SketchObject[], editing: string | null) {
  const sketch = renderHook(() => useSketch()).result;
  act(() => sketch.current.commit({ objects, selection: editing ? [editing] : [] }));
  const opened: (string | null)[] = [];
  const field = document.createElement("div");
  const hook = renderHook(() => {
    const editor = useRef<HTMLDivElement | null>(field);
    return useCaptions({
      sketch: sketch.current,
      linkNames: new Map([["A", "AB"]]),
      editing,
      onEditing: (id) => opened.push(id),
      editor,
      onLabelPick: () => {},
      look: LOOK,
    });
  }).result;
  return {
    hook,
    field,
    opened,
    page: () => sketch.current.state.objects,
    picked: () => sketch.current.state.selection,
    at: (id: string) => sketch.current.state.objects.find((object) => object.id === id),
  };
}

describe("keeping what was written", () => {
  it("keeps the text, where there is any", () => {
    const { hook, at } = writing([CAPTION], "cap");
    act(() => hook.current.settleCaption("cap", "<b>Kept</b>"));
    const found = at("cap");
    expect(found && isCaption(found) ? found.html : null).toBe("<b>Kept</b>");
  });

  /**
   * A caption that says nothing when it is finished is taken off the sheet
   * rather than left sitting there empty.
   */
  it("takes a blank one off the sheet, and lets go of it", () => {
    const { hook, page, picked, opened } = writing([CAPTION], "cap");
    act(() => hook.current.settleCaption("cap", "<p><br></p>"));
    expect(page().filter(isCaption)).toHaveLength(0);
    expect(picked()).toEqual([]);
    expect(opened).toEqual([null]);
  });

  it("leaves a caption alone where the text has not changed", () => {
    const { hook, at } = writing([CAPTION], "cap");
    act(() => hook.current.settleCaption("cap", "Hello"));
    const found = at("cap");
    expect(found && isCaption(found) ? found.html : null).toBe("Hello");
  });
});

describe("putting a caption away", () => {
  /**
   * The text lives in the browser while a caption is open, so it is read back
   * out of the field before that field goes.
   */
  it("reads what was typed out of the field on the way out", () => {
    const { hook, field, at } = writing([CAPTION], "cap");
    field.innerHTML = "Typed since";
    act(() => hook.current.closeCaption(null));
    const found = at("cap");
    expect(found && isCaption(found) ? found.html : null).toBe("Typed since");
  });

  /**
   * Putting one away hands it back to the selection, so the palette is still on
   * it and its grip is still there.
   */
  it("hands the caption back to the selection", () => {
    const { hook, field, picked, opened } = writing([CAPTION], "cap");
    field.innerHTML = "Still here";
    act(() => hook.current.closeCaption(null));
    expect(picked()).toEqual(["cap"]);
    expect(opened).toEqual([null]);
  });

  /** Opening one lets go of the selection rather than setting the bar on two things. */
  it("lets go of the selection when another is opened", () => {
    const { hook, field, picked, opened } = writing([CAPTION], "cap");
    field.innerHTML = "Still here";
    act(() => hook.current.closeCaption("other"));
    expect(picked()).toEqual([]);
    expect(opened).toEqual(["other"]);
  });

  /** A caption left empty is gone by now, so a selection cannot hold what is not there. */
  it("hands back nothing where the caption was blank", () => {
    const { hook, field, picked } = writing([CAPTION], "cap");
    field.innerHTML = "";
    act(() => hook.current.closeCaption(null));
    expect(picked()).toEqual([]);
  });
});

describe("making one", () => {
  it("puts a caption where it was asked for, and opens it to type in", () => {
    const { hook, page, picked, opened } = writing([], null);
    act(() => hook.current.makeCaption({ x: 10, y: 20 }, 180));
    const made = page().filter(isCaption);
    expect(made).toHaveLength(1);
    expect(made[0].x).toBe(10);
    expect(made[0].width).toBe(180);
    expect(picked()).toEqual([made[0].id]);
    expect(opened).toEqual([made[0].id]);
  });
});
