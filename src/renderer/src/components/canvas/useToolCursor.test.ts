/**
 * Where GRASP's own cursor is. `Canvas.cursor.test.tsx` drives the same hook
 * through the sheet; what this adds is everything the sheet cannot easily be
 * asked about: a finger, a tool that draws no cursor, and the pointer being
 * kept across a change from one to the other.
 */

import { act, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { describe, expect, it } from "vitest";
import { HOTSPOT } from "./cursorGeometry";
import { useToolCursor } from "./useToolCursor";

/** Where the sheet says the pointer is, whatever the event carried. */
const AT = { x: 200, y: 140 };
const screenOf = () => AT;

/**
 * A pointer move of the kind the sheet hands the hook. `over` is what the
 * pointer is on: the sheet itself by default, which is bare paper.
 */
function moved(kind = "mouse", over?: Element) {
  const sheet = document.createElement("div");
  return {
    pointerType: kind,
    currentTarget: sheet,
    target: over ?? sheet,
  } as unknown as PointerEvent<HTMLDivElement>;
}

/** A layer of the cursor, as the sheet mounts one. */
function layer() {
  return document.createElementNS("http://www.w3.org/2000/svg", "svg");
}

/** The hook holding one layer, the way the sheet hands it one. */
function held(tool: string) {
  const box = layer();
  const cursor = renderHook(() => useToolCursor(tool, screenOf));
  // The sheet mounts the layers and hands each one over; the hook holds no
  // element of its own. `drop` is what React calls when the layer unmounts.
  let drop: (() => void) | undefined;
  act(() => {
    drop = cursor.result.current.hold(box) ?? undefined;
  });
  return { cursor, box, drop };
}

describe("where the drawn cursor is", () => {
  it("is nowhere until the pointer has been on the sheet", () => {
    const { cursor } = held("point");
    expect(cursor.result.current.showing).toBe(false);
  });

  it("goes to the pointer, with the hotspot on it rather than the corner", () => {
    const { cursor, box } = held("point");
    act(() => cursor.result.current.follow(moved()));
    expect(cursor.result.current.showing).toBe(true);
    expect(box.style.transform).toBe(`translate(${AT.x - HOTSPOT.x}px, ${AT.y - HOTSPOT.y}px)`);
  });

  it("goes with the pointer when it leaves the sheet", () => {
    const { cursor } = held("point");
    act(() => cursor.result.current.follow(moved()));
    act(() => cursor.result.current.away());
    expect(cursor.result.current.showing).toBe(false);
  });

  it("draws nothing under a finger, which has no cursor to draw", () => {
    const { cursor, box } = held("point");
    act(() => cursor.result.current.follow(moved("touch")));
    expect(cursor.result.current.showing).toBe(false);
    expect(box.style.transform).toBe("");
  });

  it("lets a layer go when the sheet takes it off, and stops moving it", () => {
    const { cursor, box, drop } = held("point");
    act(() => cursor.result.current.follow(moved()));
    expect(box.style.transform).not.toBe("");

    // The sheet unmounts the layer, which is what the ref's cleanup is for.
    act(() => drop?.());
    box.style.transform = "";
    act(() => cursor.result.current.follow(moved()));
    expect(box.style.transform).toBe("");
  });

  it("is not taken down by a finger lifting off a screen that has both", () => {
    const { cursor } = held("point");
    act(() => cursor.result.current.follow(moved()));
    act(() => cursor.result.current.away(moved("touch")));
    expect(cursor.result.current.showing).toBe(true);
  });

  it("draws nothing for a tool GRASP has no cursor for", () => {
    // The hand keeps the platform's grab, so the sheet must keep its own cursor.
    const { cursor } = held("hand");
    act(() => cursor.result.current.follow(moved()));
    expect(cursor.result.current.showing).toBe(false);
  });

  it("keeps following while a tool with no cursor is up, so the next one is not stale", () => {
    // Hold space to pan, drag the sheet, let go: the cursor must come back
    // under the pointer rather than where the pan began. One hook throughout,
    // so this fails both if the pointer stops being recorded under the hand and
    // if nothing puts the box in its place when the cursor comes back.
    const box = layer();
    const cursor = renderHook(({ tool }) => useToolCursor(tool, screenOf), {
      initialProps: { tool: "hand" },
    });
    // The hand draws no cursor, so the sheet mounts no layer to move.
    act(() => cursor.result.current.follow(moved()));
    expect(box.style.transform).toBe("");

    // Letting go of the space bar puts a tool with a cursor back, and the sheet
    // mounts its layers. They have to land where the pointer is now, not where
    // the pan began, and nothing but the pointer moved.
    act(() => {
      cursor.result.current.hold(box);
    });
    cursor.rerender({ tool: "point" });
    expect(box.style.transform).toBe(`translate(${AT.x - HOTSPOT.x}px, ${AT.y - HOTSPOT.y}px)`);
  });

  it("draws none over something that carries a cursor of its own", () => {
    // A caption's I-beam and a label's move say what they are for; two cursors
    // at once says less than either.
    const label = document.createElement("span");
    label.className = "canvas__label";
    const { cursor } = held("point");
    act(() => cursor.result.current.follow(moved()));
    expect(cursor.result.current.showing).toBe(true);
    act(() => cursor.result.current.follow(moved("mouse", label)));
    expect(cursor.result.current.showing).toBe(false);
  });
});
