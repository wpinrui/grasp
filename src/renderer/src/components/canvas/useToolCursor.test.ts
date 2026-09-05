/**
 * Where GRASP's own cursor is. `Canvas.cursor.test.tsx` drives the same hook
 * through the sheet; what this adds is everything the sheet cannot easily be
 * asked about: a finger, a tool that draws no cursor, and the pointer being
 * kept across a change from one to the other.
 */

import { act, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { describe, expect, it } from "vitest";
import { HOST_MOVED } from "../../../../shared/embed";
import { ARROW_TIP, HOTSPOT } from "./cursorGeometry";
import { useToolCursor } from "./useToolCursor";

/** Where the sheet says the pointer is, whatever the event carried. */
const AT = { x: 200, y: 140 };
const screenOf = () => AT;

/** A sheet that can be moved under the pointer, or taken out from under it. */
function sliding() {
  const reading = { at: AT as { x: number; y: number } | null };
  return { reading, screenOf: () => reading.at };
}

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
function held(tool: string, reader: () => { x: number; y: number } | null = screenOf) {
  const box = layer();
  const cursor = renderHook(() => useToolCursor(tool, reader));
  // The sheet mounts the layers and hands each one over; the hook holds no
  // element of its own. `drop` is what React calls when the layer unmounts.
  let drop: (() => void) | undefined;
  act(() => {
    drop = cursor.result.current.hold(box) ?? undefined;
  });
  return { cursor, box, drop };
}

/**
 * A move carrying where in the window the pointer is, which is what the hook
 * keeps so it can ask the sheet again after the sheet has moved.
 */
function movedIn(clientX: number, clientY: number) {
  return { ...moved(), clientX, clientY } as unknown as PointerEvent<HTMLDivElement>;
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

/**
 * The sheet can move out from under a pointer that has not moved. Left alone,
 * the cursor stays drawn where the pointer used to be: stuck, and pointing at
 * nothing, with the platform's own cursor still hidden.
 */
describe("the sheet moving under a pointer that has not moved", () => {
  it("asks the sheet again where the pointer is, rather than staying put", () => {
    const sheet = sliding();
    const { cursor, box } = held("point", sheet.screenOf);
    act(() => cursor.result.current.follow(movedIn(320, 240)));
    expect(box.style.transform).toBe(`translate(${AT.x - HOTSPOT.x}px, ${AT.y - HOTSPOT.y}px)`);

    // The view is panned: the same pointer is over a different part of it.
    sheet.reading.at = { x: 60, y: 30 };
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(box.style.transform).toBe(`translate(${60 - HOTSPOT.x}px, ${30 - HOTSPOT.y}px)`);
    expect(cursor.result.current.showing).toBe(true);
  });

  it("puts the cursor away when the sheet is no longer under the pointer at all", () => {
    const sheet = sliding();
    const { cursor } = held("point", sheet.screenOf);
    act(() => cursor.result.current.follow(movedIn(320, 240)));

    sheet.reading.at = null;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(cursor.result.current.showing).toBe(false);
  });

  it("puts the cursor away when the page framing GRASP says it moved", () => {
    // Scrolled in a page, the frame moves and nothing inside it hears: the
    // pointer's own place in the window is stale too, so there is nothing left
    // to ask the sheet with.
    const { cursor } = held("point");
    act(() => cursor.result.current.follow(movedIn(320, 240)));
    expect(cursor.result.current.showing).toBe(true);

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: HOST_MOVED }));
    });
    expect(cursor.result.current.showing).toBe(false);
  });

  it("stays where it is for a message it does not know", () => {
    const { cursor } = held("point");
    act(() => cursor.result.current.follow(movedIn(320, 240)));
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: "something else" }));
    });
    expect(cursor.result.current.showing).toBe(true);
  });

  it("moves the Arrow by its own tip when it is asked again", () => {
    const sheet = sliding();
    const { cursor, box } = held("arrow", sheet.screenOf);
    act(() => cursor.result.current.follow(movedIn(320, 240)));
    sheet.reading.at = { x: 90, y: 70 };
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(box.style.transform).toBe(`translate(${90 - ARROW_TIP.x}px, ${70 - ARROW_TIP.y}px)`);
  });
});
